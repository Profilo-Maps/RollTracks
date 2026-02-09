declare module '@sphereon/react-native-argon2' {
  interface Argon2Config {
    iterations?: number;
    memory?: number;
    parallelism?: number;
    hashLength?: number;
    mode?: 'argon2d' | 'argon2i' | 'argon2id';
  }

  interface Argon2Result {
    rawHash: string;
    encodedHash: string;
  }

  function argon2(
    password: string,
    salt: string,
    config: Argon2Config
  ): Promise<Argon2Result>;

  export default argon2;
}
