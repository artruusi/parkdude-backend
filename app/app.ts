import express from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import {passport} from './middlewares/passport';
import {createRouter} from './router';
import {StatusError} from './utils/errors';
import {Request, Response, NextFunction, Express} from 'express';
import {createConnection, getConnectionManager, getConnection} from 'typeorm';
import {EntityNotFoundError} from 'typeorm/error/EntityNotFoundError';
import {ValidationError} from 'class-validator';
import {TypeormStore} from 'connect-typeorm';
import {Session} from './entities/session';
import {entities} from './entities';
import {migrations} from './migrations/index';

export async function createApp(): Promise<Express> {
  if (getConnectionManager().connections.length === 0) {
    await createConnection({
      type: 'postgres',
      host: process.env.TYPEORM_HOST,
      username: process.env.TYPEORM_USERNAME,
      password: process.env.TYPEORM_PASSWORD,
      database: process.env.TYPEORM_DATABASE,
      port: process.env.TYPEORM_PORT ? +process.env.TYPEORM_PORT : 5432,
      migrationsRun: process.env.TYPEORM_MIGRATIONS_RUN == 'true',
      synchronize: process.env.TYPEORM_SYNCHRONIZE == 'true',
      logging: process.env.TYPEORM_LOGGING == 'true',
      entities,
      migrations
    });
  }

  const app = express();

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  const repository = getConnection().getRepository(Session);

  app.use(express.json());
  app.use(cookieParser());

  const sessionSecret = process.env.SESSION_SECRET;
  if (sessionSecret === undefined || sessionSecret === 'CHANGE_THIS') {
    throw new Error('Failed to read SESSION_SECRET environment variable. Make sure it is set and changed.');
  }

  if (!process.env.COMPANY_EMAIL) {
    throw new Error('Failed to read COMPANY_EMAIL environment variable. Make sure it is set.');
  }

  app.use(session({
    secret: sessionSecret,
    name: 'sessionId',
    resave: false,
    rolling: true, // refresh expiry counters on use
    saveUninitialized: false,
    cookie: {maxAge: 1000 * 60 * 60}, // 1 hour default expiration
    store: new TypeormStore({
      cleanupLimit: 2,
      limitSubquery: true,
      ttl: 60 * 60 * 24 * 90, // 90 days ttl in database if not used
    }).connect(repository),
  }));

  // Initialize passport and connect it to sessions so that it can add user property etc. to requests
  app.use(passport.initialize());
  app.use(passport.session());

  if (process.env.NODE_ENV === 'development') {
    app.use(cors({
      origin: true,
      credentials: true
    }));
  }

  app.use('/api', createRouter());

  // 404 handler (none of the routes match)
  app.use(function(req, res, next) {
    res.status(404).json({
      message: 'Content not found'
    });
  });

  // Error handler
  app.use(function(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    console.error(error);
    if (error instanceof StatusError) {
      res.status(error.statusCode).json({message: error.message});
      return;
    }

    if (error instanceof EntityNotFoundError) {
      res.status(404).json({message: 'Entity not found.'});
      return;
    }

    if (Array.isArray(error) && error[0] instanceof ValidationError) {
      // Error comes from class-validator
      const errorMessages = flatten(
        error.map((validationError: ValidationError) => Object.values(validationError.constraints))
      );
      res.status(400).json({
        message: 'Validation failed:\n' + errorMessages.join('\n'),
        errorMessages
      });
      return;
    }
    res.status(500).json({message: 'Internal server error'});
  });

  return app;
}

function flatten<T>(arrays: T[][]): T[] {
  return ([] as T[]).concat(...arrays);
}
