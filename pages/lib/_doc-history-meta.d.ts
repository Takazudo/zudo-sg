// The Node-side plugin emits this data-only module after doc-history preBuild.
declare module "virtual:zudo-sg-doc-history-meta" {
  export const docHistoryMeta: NonNullable<
    import("@takazudo/zudo-doc/factory-context").ChromeHostBindings["docHistoryMeta"]
  >;
}
