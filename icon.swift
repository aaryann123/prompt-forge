// Renders AppIcon.iconset/icon_512x512@2x.png: dark squircle with the copper forge diamond. Run: npm run icon
import AppKit
let S: CGFloat = 1024
let img = NSImage(size: NSSize(width: S, height: S))
img.lockFocus()
let inset = (S - 824) / 2
let box = NSRect(x: inset, y: inset, width: 824, height: 824)
NSBezierPath(roundedRect: box, xRadius: 185, yRadius: 185).addClip()
NSGradient(colors: [NSColor(red: 0.16, green: 0.20, blue: 0.23, alpha: 1), NSColor(red: 0.07, green: 0.09, blue: 0.11, alpha: 1)])!.draw(in: box, angle: -90)
let teal = NSColor(red: 0.91, green: 0.62, blue: 0.36, alpha: 1) // copper, the page accent
let c = S / 2, r: CGFloat = 250
let diamond = NSBezierPath()
diamond.move(to: NSPoint(x: c, y: c + r)); diamond.line(to: NSPoint(x: c + r, y: c))
diamond.line(to: NSPoint(x: c, y: c - r)); diamond.line(to: NSPoint(x: c - r, y: c)); diamond.close()
diamond.lineWidth = 44; diamond.lineJoinStyle = .round; teal.setStroke(); diamond.stroke()
let half = NSBezierPath() // left half filled, like the ⬖ in the page header
half.move(to: NSPoint(x: c, y: c + r)); half.line(to: NSPoint(x: c - r, y: c)); half.line(to: NSPoint(x: c, y: c - r)); half.close()
teal.setFill(); half.fill()
img.unlockFocus()
let png = NSBitmapImageRep(data: img.tiffRepresentation!)!.representation(using: .png, properties: [:])!
try! png.write(to: URL(fileURLWithPath: "AppIcon.iconset/icon_512x512@2x.png"))
