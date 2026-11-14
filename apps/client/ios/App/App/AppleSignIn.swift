import UIKit
import Capacitor
import AuthenticationServices

/// The app's own view controller: Capacitor's, plus the plugins that live
/// in this app rather than in a package (SceneDelegate creates it).
class ArenaViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppleSignInPlugin())
        bridge?.registerPluginInstance(AppIconPlugin())
    }

    /// The touch controls sit near the screen's edges in landscape: a swipe
    /// from an edge first goes to the game, and a second swipe opens Home,
    /// the app switcher or Control Center, so a thumb can't leave a match
    /// by accident.
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        .all
    }

    /// The home bar fades out while nobody touches near it.
    override var prefersHomeIndicatorAutoHidden: Bool {
        true
    }

    override open func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
        setNeedsUpdateOfHomeIndicatorAutoHidden()
    }
}

/// Sign in with Apple, natively (docs/ios-app.md).
///
/// JavaScript calls `AppleSignIn.authorize({ nonce })` with the SHA-256 of a
/// random nonce; Apple puts it in the identity token, and Supabase checks it
/// against the raw nonce (apps/client/src/native.ts). The answer carries the
/// identity token (to sign in with Supabase) and the one-time authorization
/// code, which the game server trades for Apple's refresh token so it can
/// revoke it when the player deletes their account.
@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]

    /// The call waiting for Apple's sheet (one at a time).
    private var pending: CAPPluginCall?

    @objc func authorize(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let earlier = self.pending {
                earlier.reject("Another sign-in started.", "busy")
            }
            self.pending = call
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            if let nonce = call.getString("nonce") {
                request.nonce = nonce
            }
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    private func finish(_ body: (CAPPluginCall) -> Void) {
        guard let call = pending else { return }
        pending = nil
        body(call)
    }
}

extension AppleSignInPlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard
            let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let tokenData = credential.identityToken,
            let identityToken = String(data: tokenData, encoding: .utf8),
            let codeData = credential.authorizationCode,
            let authorizationCode = String(data: codeData, encoding: .utf8)
        else {
            finish { $0.reject("Apple didn't send a sign-in token.", "no_token") }
            return
        }
        // Apple sends the name and email only the first time a player signs
        // in to this app; they're left out when missing.
        var result: [String: Any] = [
            "user": credential.user,
            "identityToken": identityToken,
            "authorizationCode": authorizationCode,
        ]
        if let email = credential.email { result["email"] = email }
        if let given = credential.fullName?.givenName { result["givenName"] = given }
        if let family = credential.fullName?.familyName { result["familyName"] = family }
        finish { $0.resolve(result) }
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        let cancelled = (error as? ASAuthorizationError)?.code == .canceled
        finish { call in
            call.reject(
                cancelled ? "Sign in with Apple was cancelled." : error.localizedDescription,
                cancelled ? "cancelled" : "failed"
            )
        }
    }
}

extension AppleSignInPlugin: ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
