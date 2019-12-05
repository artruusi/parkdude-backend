import {Request, Response} from 'express';
import {
  GetUsersResponse, GetUserResponse,
  UserUpdateBody, PutUpdatedUserResponse
} from '../interfaces/user.interfaces';
import {UserRole} from '../entities/user';
import {GenericResponse} from '../interfaces/general.interfaces';
import {fetchUsers, fetchUser, updateUser, deleteUser} from '../services/user.service';

export async function getUsers(req: Request, res: Response) {
  const roleFilter: UserRole | undefined = req.query.role;
  const users = await fetchUsers(roleFilter);
  const json: GetUsersResponse = {
    data: users.map((user) => user.toUserData())
  };
  res.status(200).json(json);
}

export async function getUser(req: Request, res: Response) {
  const userId = req.params.userId;
  const user = await fetchUser(userId);
  const json: GetUserResponse = {
    data: user.toUserData()
  };
  res.status(200).json(json);
}

export async function putUpdatedUser(req: Request, res: Response) {
  const userId = req.params.userId;
  const user = await fetchUser(userId);
  let data: UserUpdateBody = req.body;
  data = await updateUser(user, data);
  const json: PutUpdatedUserResponse = {
    message: 'User successfully updated',
    data: {
      id: userId,
      ...data
    }
  };
  res.status(200).json(json);
}

export async function deleteDeleteUser(req: Request, res: Response) {
  const userId = req.params.userId;
  // May not want to allow deleting self
  const user = await fetchUser(userId);
  await deleteUser(user);
  const json: GenericResponse = {
    message: 'User successfully deleted'
  };
  res.status(200).json(json);
}

export async function postClearSession(req: Request, res: Response) {
  const userId = req.params.userId;
  const user = (await fetchUser(userId)) as any;
  user.session.destroy();
  const json: GenericResponse = {
    message: 'User\'s session cleared'
  };
  res.status(200).json(json);
}
