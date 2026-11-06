import UserNotifications
import UIKit

/// Attaches the product image to a FlashRadar push.
///
/// Two things make this less trivial than the usual example:
///
/// 1. Expo does not document where it puts an image URL in the APNs
///    payload, and the community thread on iOS rich pushes ends
///    unresolved. The sender puts the URL in `data`, which Expo passes
///    through verbatim, but the exact nesting differs between SDK
///    versions — so several plausible locations are probed.
///
/// 2. Many deal images are WebP (Shopify CDN). UNNotificationAttachment
///    rejects WebP, so the bytes are decoded and re-encoded as JPEG
///    rather than attached directly.
class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttempt: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        self.bestAttempt = request.content.mutableCopy() as? UNMutableNotificationContent

        guard let content = bestAttempt else {
            contentHandler(request.content)
            return
        }

        guard let urlString = findImageURL(in: request.content.userInfo),
              let url = URL(string: urlString) else {
            contentHandler(content)
            return
        }

        // The system allows roughly 30 seconds; stay well inside it so a
        // slow CDN delivers a plain notification rather than none.
        var req = URLRequest(url: url)
        req.timeoutInterval = 12

        URLSession.shared.dataTask(with: req) { data, _, _ in
            defer { contentHandler(content) }

            guard let data = data,
                  let image = UIImage(data: data),
                  let jpeg = image.jpegData(compressionQuality: 0.85) else { return }

            let file = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString + ".jpg")

            do {
                try jpeg.write(to: file)
                let attachment = try UNNotificationAttachment(
                    identifier: "flashradar-image",
                    url: file,
                    options: nil
                )
                content.attachments = [attachment]
            } catch {
                // Fall through — a notification without the picture is
                // still worth delivering.
            }
        }.resume()
    }

    /// Called when time runs out. Deliver whatever we have.
    override func serviceExtensionTimeWillExpire() {
        if let handler = contentHandler, let content = bestAttempt {
            handler(content)
        }
    }

    private func findImageURL(in userInfo: [AnyHashable: Any]) -> String? {
        let body = userInfo["body"] as? [AnyHashable: Any]

        let candidates: [Any?] = [
            body?["image"],
            userInfo["image"],
            (userInfo["richContent"] as? [AnyHashable: Any])?["image"],
            (body?["richContent"] as? [AnyHashable: Any])?["image"],
            ((userInfo["attachments"] as? [[AnyHashable: Any]])?.first)?["url"],
        ]

        for candidate in candidates {
            if let s = candidate as? String, s.hasPrefix("http") {
                return s
            }
        }
        return nil
    }
}
