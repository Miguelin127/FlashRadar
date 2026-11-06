const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Puts the notification-service source where Xcode expects it.
 *
 * @bacons/apple-targets 5.0.0 registers the target as a synchronized
 * folder group at ios/notification-service, but never creates that
 * folder — the source stays in targets/notification-service, so the
 * extension builds with no code in it and silently does nothing.
 *
 * This copies it into place after prebuild generates the project. It
 * runs on EAS too, which matters because EAS prebuilds on its own.
 */
module.exports = function withNotificationServiceSource(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const src = path.join(
        cfg.modRequest.projectRoot,
        "targets",
        "notification-service"
      );
      const dest = path.join(
        cfg.modRequest.platformProjectRoot,
        "notification-service"
      );

      if (!fs.existsSync(src)) {
        console.warn("[notification-service] source missing at " + src);
        return cfg;
      }

      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(src, dest, { recursive: true });
      console.log("[notification-service] copied source into ios/");
      return cfg;
    },
  ]);
};
