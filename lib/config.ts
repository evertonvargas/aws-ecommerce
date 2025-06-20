import * as dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

export const getConfig = () => {
  const account = process.env.ACCOUNT;
  if (!account) {
    throw new Error("Environment variable ACCOUNT is not set");
  }

  return {
    account
  };
}