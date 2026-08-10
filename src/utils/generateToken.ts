import jwt from 'jsonwebtoken';

const generateToken = (payload: Record<string, unknown>, secret: string, expiresIn: string): string => {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
};

export default generateToken;
