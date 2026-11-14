import UIKit
import Capacitor

/// The alternate app icons players pick in Settings (docs/ios-app.md).
///
/// The icon sets live in Assets.xcassets (AppIcon-Pyranda and the others),
/// and the Alternate App Icon Sets build setting
/// (ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES) names them, so Xcode
/// writes them into the app's Info.plist. JavaScript calls
/// `AppIcon.getIcon()` for the current one and
/// `AppIcon.setIcon({ name })` to change it (no name: the default icon);
/// apps/client/src/app-icon-setting.ts draws the picker. iOS remembers the
/// choice and shows its own "You have changed the icon" alert.
@objc(AppIconPlugin)
public class AppIconPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppIconPlugin"
    public let jsName = "AppIcon"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getIcon", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setIcon", returnType: CAPPluginReturnPromise),
    ]

    /// `{ supported, name? }`: name is the alternate set in use, left out
    /// for the default icon.
    @objc func getIcon(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            var result: JSObject = [
                "supported": UIApplication.shared.supportsAlternateIcons
            ]
            if let name = UIApplication.shared.alternateIconName {
                result["name"] = name
            }
            call.resolve(result)
        }
    }

    @objc func setIcon(_ call: CAPPluginCall) {
        let name = call.getString("name")
        DispatchQueue.main.async {
            guard UIApplication.shared.supportsAlternateIcons else {
                call.reject("This device can't change the app icon.", "unsupported")
                return
            }
            UIApplication.shared.setAlternateIconName(name) { error in
                if let error = error {
                    call.reject(error.localizedDescription, "failed")
                } else {
                    call.resolve()
                }
            }
        }
    }
}
