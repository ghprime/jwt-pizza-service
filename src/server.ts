import { ContextFactory } from "./context";
import { MetricsJob } from "./metrics";
import { app } from "./service";

const port = process.argv[2] || 3000;

// initialize...
(async () => {
  await ContextFactory.context().dao();
  MetricsJob.start();
})();

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
