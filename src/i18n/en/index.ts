// English dictionary, one file per area of the app. Keys are the exact Thai text.
import common from "./common";
import staff from "./staff";
import reports from "./reports";
import notify from "./notify";
import settings from "./settings";
import proposals from "./proposals";
import history from "./history";
import usage from "./usage";
import signup from "./signup";
import comments from "./comments";

export const en: Record<string, string> = {
  ...common,
  ...staff,
  ...reports,
  ...notify,
  ...settings,
  ...proposals,
  ...history,
  ...usage,
  ...signup,
  ...comments,
};
