import UIKit
import Capacitor
import WebKit

private func furiganaColor(fromHex hex: String) -> UIColor? {
    var cleaned = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if cleaned.hasPrefix("#") {
        cleaned.removeFirst()
    }
    guard cleaned.count == 6, let rgb = UInt64(cleaned, radix: 16) else {
        return nil
    }
    return UIColor(
        red: CGFloat((rgb >> 16) & 0xFF) / 255.0,
        green: CGFloat((rgb >> 8) & 0xFF) / 255.0,
        blue: CGFloat(rgb & 0xFF) / 255.0,
        alpha: 1.0
    )
}

private let furiganaLightCanvasColor = UIColor(red: 238.0 / 255.0, green: 242.0 / 255.0, blue: 249.0 / 255.0, alpha: 1.0)
private let furiganaDarkCanvasColor = UIColor(red: 11.0 / 255.0, green: 13.0 / 255.0, blue: 19.0 / 255.0, alpha: 1.0)

private final class FuriganaThemeMessageHandler: NSObject, WKScriptMessageHandler {
    weak var controller: FuriganaBridgeViewController?

    init(controller: FuriganaBridgeViewController) {
        self.controller = controller
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        let bgHex = (body["bg"] as? String) ?? "#F2F2F7"
        let isDark = (body["isDark"] as? Bool) ?? false
        DispatchQueue.main.async { [weak self] in
            self?.controller?.applyCanvasTheme(bgHex: bgHex, isDark: isDark)
        }
    }
}

class FuriganaBridgeViewController: CAPBridgeViewController {
    private var currentCanvasColor: UIColor = furiganaLightCanvasColor
    private var currentIsDark: Bool = false

    /// iPhone is portrait-only; iPad keeps all four orientations (portrait + landscape).
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        if UIDevice.current.userInterfaceIdiom == .phone {
            return .portrait
        }
        return .all
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if ProcessInfo.processInfo.environment["FURIGANA_DARK_MODE"] == "1" {
            currentIsDark = true
            currentCanvasColor = furiganaDarkCanvasColor
        }
        configureScrollAndBackgrounds()
    }

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        configureScrollAndBackgrounds()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        configureScrollAndBackgrounds()
    }

    func applyCanvasTheme(bgHex: String, isDark: Bool) {
        currentIsDark = isDark
        currentCanvasColor = furiganaColor(fromHex: bgHex) ?? (isDark ? furiganaDarkCanvasColor : furiganaLightCanvasColor)
        configureScrollAndBackgrounds()
    }

    private func configureScrollAndBackgrounds() {
        overrideUserInterfaceStyle = currentIsDark ? .dark : .light
        view.backgroundColor = currentCanvasColor
        view.window?.backgroundColor = currentCanvasColor
        view.window?.overrideUserInterfaceStyle = currentIsDark ? .dark : .light

        guard let webView = self.webView else { return }
        webView.isOpaque = true
        webView.backgroundColor = currentCanvasColor
        webView.scrollView.backgroundColor = currentCanvasColor
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
        webView.scrollView.alwaysBounceHorizontal = false
        if #available(iOS 15.0, *) {
            webView.underPageBackgroundColor = currentCanvasColor
        }
    }

    override open func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        if let initialTab = ProcessInfo.processInfo.environment["FURIGANA_INITIAL_TAB"], !initialTab.isEmpty {
            let scriptSource = "try { localStorage.setItem('furigana_active_tab', '\(initialTab)'); } catch(e) {}"
            let userScript = WKUserScript(source: scriptSource, injectionTime: .atDocumentStart, forMainFrameOnly: true)
            configuration.userContentController.addUserScript(userScript)
        }
        if let darkEnv = ProcessInfo.processInfo.environment["FURIGANA_DARK_MODE"], !darkEnv.isEmpty {
            let scriptSource = "try { localStorage.setItem('furigana_dark_mode', '\(darkEnv)'); } catch(e) {}"
            let userScript = WKUserScript(source: scriptSource, injectionTime: .atDocumentStart, forMainFrameOnly: true)
            configuration.userContentController.addUserScript(userScript)
            if darkEnv == "1" {
                currentIsDark = true
                currentCanvasColor = furiganaDarkCanvasColor
            }
        }
        configuration.userContentController.removeScriptMessageHandler(forName: "furiganaTheme")
        configuration.userContentController.add(FuriganaThemeMessageHandler(controller: self), name: "furiganaTheme")

        let earlyThemeSyncScript = """
        try {
            var isDark = localStorage.getItem('furigana_dark_mode') === '1';
            var bg = isDark ? '#000000' : '#F2F2F7';
            document.documentElement.classList.toggle('dark', isDark);
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
            document.documentElement.style.setProperty('--bg-primary', bg);
            document.documentElement.style.backgroundColor = bg;
            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.furiganaTheme) {
                window.webkit.messageHandlers.furiganaTheme.postMessage({ bg: bg, isDark: isDark });
            }
        } catch(e) {}
        """
        configuration.userContentController.addUserScript(
            WKUserScript(source: earlyThemeSyncScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )

        // Pixiv 导入 needs a native transport: the packaged bundle has no /api routes and
        // cross-origin fetch to pixiv.net is blocked (Android does this in MainActivity).
        PixivNativeBridge.register(on: configuration)

        let webView = super.webView(with: frame, configuration: configuration)
        PixivNativeBridge.attach(webView)
        webView.isOpaque = true
        webView.backgroundColor = currentCanvasColor
        webView.scrollView.backgroundColor = currentCanvasColor
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
        webView.scrollView.alwaysBounceHorizontal = false
        if #available(iOS 15.0, *) {
            webView.underPageBackgroundColor = currentCanvasColor
        }
        return webView
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let initialDark = ProcessInfo.processInfo.environment["FURIGANA_DARK_MODE"] == "1"
        window = UIWindow(windowScene: windowScene)
        window?.backgroundColor = initialDark ? furiganaDarkCanvasColor : furiganaLightCanvasColor
        window?.overrideUserInterfaceStyle = initialDark ? .dark : .light
        window?.rootViewController = FuriganaBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
