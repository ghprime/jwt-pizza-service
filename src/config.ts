export default {
  jwtSecret: "anyrandomsecret",
  db: {
    connection: {
      host: "127.0.0.1",
      user: "root",
      password: "monkey123",
      database: "pizza",
      connectTimeout: 60000,
    },
    listPerPage: 10,
  },
  factory: {
    url: "https://pizza-factory.cs329.click",
    apiKey: "0883cd28c0c34b8f8d8c901257a484f8",
  },
} as const;
