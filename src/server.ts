import { ContextFactory } from "./context";
import { app } from "./service";

const port = process.argv[2] || 3000;

(async () => {
  await ContextFactory.context().dao();
})();
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
