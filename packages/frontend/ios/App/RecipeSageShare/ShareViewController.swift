import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: SLComposeServiceViewController {

    // MARK: - Constants

    private let appGroupIdentifier = "group.com.recipesage.app.shared"
    private let urlScheme = "recipesage://"
    private let sharedDataKey = "sharedRecipeData"

    // MARK: - State

    private var sharedURL: URL?
    private var sharedText: String?
    private var sharedImages: [UIImage] = []
    private var extractionComplete = false

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        placeholder = "Add a note to this recipe..."
        title = "RecipeSage"
        extractSharedItems()
    }

    override func isContentValid() -> Bool {
        return extractionComplete && (sharedURL != nil || !sharedImages.isEmpty || sharedText != nil)
    }

    override func didSelectPost() {
        saveSharedData()
        openMainApp()
        self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    override func configurationItems() -> [Any]! {
        return []
    }

    // MARK: - Extraction

    private func extractSharedItems() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            extractionComplete = true
            triggerContentValidation()
            return
        }

        let group = DispatchGroup()
        var extractedURL: URL?
        var extractedText: String?
        var extractedImages: [UIImage] = []

        for item in extensionItems {
            guard let attachments = item.attachments else { continue }

            for provider in attachments {
                // Try URL first (Safari, browsers)
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { data, error in
                        if let url = data as? URL {
                            extractedURL = url
                        } else if let urlString = data as? String, let url = URL(string: urlString) {
                            extractedURL = url
                        }
                        group.leave()
                    }
                }

                // Try text (Instagram captions, plain text shares)
                if provider.hasItemConformingToTypeIdentifier(UTType.text.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.text.identifier, options: nil) { data, error in
                        if let text = data as? String, !text.isEmpty {
                            // If the text itself is a URL, treat it as one
                            if let url = self.parseURL(from: text) {
                                if extractedURL == nil {
                                    extractedURL = url
                                }
                            } else {
                                extractedText = text
                            }
                        }
                        group.leave()
                    }
                }

                // Try property list (some apps share URLs as plist)
                if provider.hasItemConformingToTypeIdentifier(UTType.propertyList.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.propertyList.identifier, options: nil) { data, error in
                        if let dict = data as? [String: Any],
                           let urlDict = dict[NSExtensionJavaScriptPreprocessingResultsKey] as? [String: Any] {
                            if let urlString = urlDict["url"] as? String, let url = URL(string: urlString) {
                                if extractedURL == nil {
                                    extractedURL = url
                                }
                            }
                            if let title = urlDict["title"] as? String, extractedText == nil {
                                extractedText = title
                            }
                        }
                        group.leave()
                    }
                }

                // Try images
                if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { data, error in
                        if let image = data as? UIImage {
                            extractedImages.append(image)
                        } else if let imageURL = data as? URL {
                            if let image = self.loadImageFromURL(imageURL) {
                                extractedImages.append(image)
                            }
                        }
                        group.leave()
                    }
                }
            }
        }

        group.notify(queue: .main) { [weak self] in
            guard let self = self else { return }
            self.sharedURL = extractedURL
            self.sharedText = extractedText
            self.sharedImages = extractedImages
            self.extractionComplete = true
            self.triggerContentValidation()
        }
    }

    /// Attempt to parse a URL from a raw string.
    private func parseURL(from text: String) -> URL? {
        // Direct URL
        if let url = URL(string: text), url.scheme != nil, ["http", "https"].contains(url.scheme) {
            return url
        }
        // Extract first URL found in text
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let range = NSRange(text.startIndex..., in: text)
        if let match = detector?.firstMatch(in: text, options: [], range: range),
           let url = match.url,
           ["http", "https"].contains(url.scheme) {
            return url
        }
        return nil
    }

    /// Load a UIImage from a file URL (temporary file from share sheet).
    private func loadImageFromURL(_ fileURL: URL) -> UIImage? {
        // Access security-scoped resource
        let accessing = fileURL.startAccessingSecurityScopedResource()
        defer {
            if accessing { fileURL.stopAccessingSecurityScopedResource() }
        }
        return UIImage(contentsOfFile: fileURL.path)
    }

    private func triggerContentValidation() {
        DispatchQueue.main.async { [weak self] in
            _ = self?.isContentValid()
        }
    }

    // MARK: - Save Data

    private func saveSharedData() {
        guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else { return }

        var data: [String: Any] = [:]
        data["timestamp"] = Date().timeIntervalSince1970
        data["userNote"] = contentText

        if let url = sharedURL {
            data["url"] = url.absoluteString

            // Detect Instagram-specific handling
            if isInstagramURL(url) {
                data["source"] = "instagram"
            }
        }

        if let text = sharedText {
            data["text"] = text
        }

        // Save images as JPEG data to shared UserDefaults
        if !sharedImages.isEmpty {
            var imageDataArray: [Data] = []
            for image in sharedImages {
                if let jpegData = image.jpegData(compressionQuality: 0.8) {
                    imageDataArray.append(jpegData)
                }
            }
            // Store image count and data in shared container
            data["imageCount"] = imageDataArray.count
            // Save images individually to avoid UserDefaults size issues
            if let containerURL = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: appGroupIdentifier
            ) {
                let imagesDir = containerURL.appendingPathComponent("shared_images", isDirectory: true)
                try? FileManager.default.createDirectory(at: imagesDir, withIntermediateDirectories: true)

                // Clean up old shared images
                try? FileManager.default.removeItem(at: imagesDir)

                for (index, imageData) in imageDataArray.enumerated() {
                    let fileURL = imagesDir.appendingPathComponent("shared_image_\(index).jpg")
                    try? imageData.write(to: fileURL)
                }
                data["imagesPath"] = imagesDir.path
            }
        }

        defaults.set(data, forKey: sharedDataKey)
        defaults.synchronize()
    }

    // MARK: - Open Main App

    private func openMainApp() {
        var components = URLComponents(string: "\(urlScheme)import")

        var queryItems: [URLQueryItem] = []

        if let url = sharedURL {
            queryItems.append(URLQueryItem(name: "url", value: url.absoluteString))
        }

        if let text = sharedText {
            queryItems.append(URLQueryItem(name: "text", value: text))
        }

        if !sharedImages.isEmpty {
            queryItems.append(URLQueryItem(name: "imageCount", value: String(sharedImages.count)))
        }

        if !contentText.isEmpty {
            queryItems.append(URLQueryItem(name: "note", value: contentText))
        }

        if !queryItems.isEmpty {
            components?.queryItems = queryItems
        }

        guard let openURL = components?.url else { return }

        // Use selector-based approach for opening URL from extension
        var responder: UIResponder? = self as UIResponder
        let selector = sel_registerName("openURL:")

        while responder != nil {
            if responder!.responds(to: selector) && responder != self {
                responder!.perform(selector, with: openURL)
                break
            }
            responder = responder!.next
        }
    }

    // MARK: - Helpers

    /// Check if a URL is from Instagram.
    private func isInstagramURL(_ url: URL) -> Bool {
        let host = url.host?.lowercased() ?? ""
        return host.contains("instagram.com") || host.contains("instagr.am")
    }
}
