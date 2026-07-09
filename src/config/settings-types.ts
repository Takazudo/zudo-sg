// Re-export shared settings types from zudo-doc. The local trigger item stays
// project-owned because this site uses the custom `toggle-sg-doc-tweak` channel
// for its doc-chrome panel button.
export type {
  TagGovernanceMode,
  TagVocabularyEntry,
  HeaderNavChildItem,
  HeaderNavItem,
  HeaderRightComponentName,
  HeaderRightComponentItem,
  HeaderRightLinkItem,
  HeaderRightHtmlItem,
  HeaderRightItem,
  BodyFootUtilAreaConfig,
  ColorModeConfig,
  LocaleConfig,
  FooterLinkItem,
  FooterLinkColumn,
  FooterTaglistLocaleConfig,
  FooterTaglistConfig,
  FooterConfig,
  HtmlPreviewConfig,
  FrontmatterPreviewConfig,
  TagPlacement,
  VersionConfig,
  ChangelogConfig,
  MetaTagsConfig,
  SiteHeadConfig,
  Settings,
} from "@takazudo/zudo-doc/settings";

export type HeaderRightTriggerName = "design-token-panel" | "ai-chat";

export interface HeaderRightTriggerItem {
  type: "trigger";
  trigger: HeaderRightTriggerName;
}
