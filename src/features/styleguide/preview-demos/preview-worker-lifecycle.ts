type PreviewWorker = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

// MSW stop messages affect the document's worker client, so replacement mounts
// must wait for the previous start AND asynchronous teardown to settle.
export function createPreviewWorkerLifecycle() {
  let previous = Promise.resolve();
  let teardownFailure: Error | undefined;

  return function activate(
    load: () => Promise<PreviewWorker>,
    ready: () => void,
    failed: (error: unknown) => void,
    reportCleanup: (error: Error) => void = (error) => console.error(error),
  ): () => void {
    let disposed = false;
    let release!: () => void;
    const disposal = new Promise<void>((resolve) => { release = resolve; });
    const lifetime = previous.then(async () => {
      let worker: PreviewWorker | undefined;
      try {
        if (disposed) return;
        if (teardownFailure) throw teardownFailure;
        const loaded = await load();
        if (disposed) return;
        worker = loaded;
        await worker.start();
        if (!disposed) {
          ready();
          await disposal;
        }
      } catch (error) {
        if (!disposed) failed(error);
      } finally {
        if (worker) {
          try {
            // MSW 3.0.4 stop waits for a worker acknowledgement. If that never
            // arrives, report failed cleanup and forbid a replacement lifetime.
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              await Promise.race([
                worker.stop(),
                new Promise<never>((_, reject) => {
                  timer = setTimeout(() => reject(new Error("Mock worker did not acknowledge cleanup within 10 seconds.")), 10_000);
                }),
              ]);
            } finally {
              clearTimeout(timer);
            }
          } catch (cause) {
            teardownFailure = new Error("Mock worker cleanup failed; reload the preview before retrying.", { cause });
            reportCleanup(teardownFailure);
          }
        }
      }
    });
    // Observe even callback failures; the queue must never float a rejection.
    previous = lifetime.catch((error: unknown) => {
      teardownFailure = new Error("Mock worker lifecycle failed; reload the preview before retrying.", { cause: error });
      console.error(teardownFailure);
    });
    return () => { disposed = true; release(); };
  };
}
