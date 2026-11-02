// Prompt Forge.app — native Dock app: runs app.js as a child process and shows it in a WKWebView window.
// Build: npm run build   ·   Install to ~/Applications: npm run install-app
import AppKit
import WebKit

// ponytail: project path baked in at compile time; rebuild if the prompt-forge folder moves.
let projectDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent().path
let url = URL(string: "http://127.0.0.1:3456")!

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var web: WKWebView!
    let server = Process()

    func applicationDidFinishLaunching(_ note: Notification) {
        // Interactive login shell so nvm's node is on PATH (Dock apps get a bare environment).
        // If the dashboard already started the server, this child exits on EADDRINUSE and we use that one.
        server.executableURL = URL(fileURLWithPath: "/bin/zsh")
        server.arguments = ["-lic", "exec node app.js"]
        server.currentDirectoryURL = URL(fileURLWithPath: projectDir)
        server.standardInput = FileHandle.nullDevice
        let log = NSHomeDirectory() + "/Library/Logs/PromptForge.log"
        FileManager.default.createFile(atPath: log, contents: nil)
        server.standardOutput = FileHandle(forWritingAtPath: log)
        server.standardError = server.standardOutput
        try? server.run()

        web = WKWebView(frame: .zero)
        web.navigationDelegate = self
        // Matches the page's --bg in both appearances so the title bar and overscroll blend in.
        web.underPageBackgroundColor = NSColor(name: nil) { $0.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            ? NSColor(red: 0.12, green: 0.13, blue: 0.15, alpha: 1) : NSColor(red: 0.95, green: 0.96, blue: 0.97, alpha: 1) }

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 820, height: 900),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Prompt Forge"
        window.titlebarAppearsTransparent = true
        window.backgroundColor = web.underPageBackgroundColor
        window.contentView = web
        window.setFrameAutosaveName("PromptForge")
        if window.frame.origin == .zero { window.center() }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        web.load(URLRequest(url: url))
    }

    // Server takes a moment to come up: keep retrying until the page loads.
    func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { w.load(URLRequest(url: url)) }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ note: Notification) { if server.isRunning { server.terminate() } }
}

// Without an Edit menu, ⌘C/⌘V/⌘A do nothing inside the web view.
let menu = NSMenu()
let appItem = NSMenuItem(); menu.addItem(appItem)
appItem.submenu = NSMenu()
appItem.submenu!.addItem(withTitle: "Quit Prompt Forge", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
let editItem = NSMenuItem(); menu.addItem(editItem)
let edit = NSMenu(title: "Edit"); editItem.submenu = edit
edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.mainMenu = menu
app.setActivationPolicy(.regular)
app.run()
