import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    self.contentViewController = flutterViewController

    let defaultSize = NSSize(width: 520, height: 860)
    let initialFrame = NSRect(origin: self.frame.origin, size: defaultSize)
    self.setFrame(initialFrame, display: true)
    self.center()
    self.minSize = defaultSize
    self.maxSize = defaultSize
    self.titleVisibility = .hidden
    self.titlebarAppearsTransparent = true
    self.isMovableByWindowBackground = true
    self.styleMask.remove(.resizable)
    self.styleMask.remove(.fullScreen)
    self.styleMask.insert(.fullSizeContentView)
    self.standardWindowButton(.zoomButton)?.isHidden = true
    self.standardWindowButton(.zoomButton)?.isEnabled = false
    self.collectionBehavior.remove(.fullScreenPrimary)

    RegisterGeneratedPlugins(registry: flutterViewController)

    super.awakeFromNib()
  }
}
