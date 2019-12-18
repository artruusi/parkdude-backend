import {User, UserRole} from '../entities/user';
import {UserBody, UserUpdateBody, UserData, UserSessions} from '../interfaces/user.interfaces';
import {Session} from '../entities/session';
import {getConnection} from 'typeorm';

export async function fetchUsers(userRole?: UserRole): Promise<User[]> {
  if (!userRole) {
    return await User.find();
  }
  return await User.find({where: {role: userRole}});
}

export async function getUser({email}: UserBody): Promise <User | undefined> {
  return await User.findOne({email});
}

export async function fetchUser(id: string): Promise<User> {
  return await User.findOneOrFail(id);
}

export async function getOrCreateUser({email, name}: UserBody): Promise<User> {
  let user = await User.findOne({email});
  if (user === undefined) {
    user = await User.create({
      name: name,
      email: email,
      role: email.endsWith('@innogiant.com') ? UserRole.VERIFIED : UserRole.UNVERIFIED
    }).save();
  }
  return user;
}

export async function updateUser(user: User, data: UserUpdateBody): Promise<User> {
  user.email = data.email;
  user.name = data.name;
  user.role = data.role;
  return await user.save();
}

export async function deleteUser(user: User) {
  await user.remove();
}

export async function getSessions(users: User[]): Promise<UserSessions[]> {
  const sessionRepo = getConnection().getRepository(Session);
  const sessions: any[] = await sessionRepo.find();
  sessions.map((sess) => sess.userid = JSON.parse(sess.json).passport.user);
  sessions.sort((a, b) => a.userid < b.userid ? -1 : 1);
  users.sort((a, b) => a.id < b.id ? -1 : 1);

  const userSessions = users as UserSessions[];
  let sessIdx = 0;
  let userIdx = 0;
  while (sessIdx < sessions.length && userIdx < userSessions.length) {
    if (userSessions[userIdx].id === sessions[sessIdx].userid) {
      (userSessions[userIdx].sessions = userSessions[userIdx].sessions || []).push(sessions[sessIdx].id);
      sessIdx++;
    } else if (userSessions[userIdx].id < sessions[sessIdx]) {
      userIdx++;
    } else {
      sessIdx++;
    }
  }
  // sessionRepo.manager.connection.close();
  return userSessions;
}

export async function getSession(user: User): Promise<UserSessions> {
  return (await getSessions(Array(user)))[0];
}

export async function clearSessions(user: UserSessions) {
  console.log('Users in clearsessions', user);
  const sessionRepo = getConnection().getRepository(Session);
  await sessionRepo.delete(user.sessions);
}
