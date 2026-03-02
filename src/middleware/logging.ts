import { Request, Response, NextFunction } from 'express';

const logging = (request: Request, _response: Response, next: NextFunction): void => {
  console.log(`${new Date().toUTCString()} ${request.method} ${request.path}`);
  next();
};

export default logging;