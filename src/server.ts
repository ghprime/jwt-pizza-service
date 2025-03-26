import { ContextFactory } from "./context";
import { Logger, GrafanaLogConsumer } from "./logger";
import { MetricsJob } from "./metrics";
import { app } from "./service";

const port = process.argv[2] || 3000;

// initialize...
(async () => {
  await ContextFactory.context().dao();
  MetricsJob.start();
  Logger.getInstance().addLogConsumer(new GrafanaLogConsumer());
})();

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
