import SwiftUI
import PhotosUI
import UIKit

/// Сжатие фото перед загрузкой: снимок с телефона весит 3–10 МБ, модератору
/// хватает 1600 px по длинной стороне — это 200–500 КБ. Заодно HEIC → JPEG.
enum ImageTools {
    static func jpeg(_ image: UIImage, max side: CGFloat = 1600, quality: CGFloat = 0.82) -> Data? {
        let s = image.size
        let k = min(1, side / max(s.width, s.height))
        let target = CGSize(width: (s.width * k).rounded(), height: (s.height * k).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let img = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return img.jpegData(compressionQuality: quality)
    }
}

/// Камера (UIImagePickerController) для SwiftUI.
struct CameraPicker: UIViewControllerRepresentable {
    let onPick: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let c = UIImagePickerController()
        c.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        c.delegate = context.coordinator
        return c
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ p: CameraPicker) { parent = p }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let img = info[.originalImage] as? UIImage { parent.onPick(img) }
            parent.dismiss()
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}

/// Поле загрузки фото: превью сразу после выбора, сжатие, загрузка на сервер.
/// Можно снять камерой или выбрать из галереи.
struct PhotoUploadBox: View {
    @Environment(\.palette) private var p
    let title: String
    let hint: String
    @Binding var uploadedURL: String

    @State private var preview: UIImage?
    @State private var busy = false
    @State private var error: String?
    @State private var askSource = false
    @State private var camera = false
    @State private var libraryItem: PhotosPickerItem?
    @State private var showLibrary = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel(title)
            Button { askSource = true } label: {
                ZStack(alignment: .bottom) {
                    if let preview {
                        Image(uiImage: preview).resizable().scaledToFill()
                            .frame(maxWidth: .infinity).frame(height: 200).clipped().contentShape(Rectangle())
                            .opacity(busy ? 0.5 : 1)
                        Text(busy ? "ЗАГРУЖАЕМ…" : uploadedURL.isEmpty ? "НЕ ЗАГРУЗИЛОСЬ · ВЫБРАТЬ СНОВА" : "✓ ЗАГРУЖЕНО · НАЖМИТЕ, ЧТОБЫ ЗАМЕНИТЬ")
                            .font(AppFont.mono(11, .bold)).em(0.04, 11).foregroundColor(p.onInk)
                            .frame(maxWidth: .infinity).padding(.vertical, 8)
                            .background(p.ink.opacity(0.85))
                    } else {
                        VStack(spacing: 6) {
                            Text("+ ЗАГРУЗИТЬ ФОТО").font(AppFont.mono(12, .bold)).em(0.04, 12).foregroundColor(p.ink)
                            Text(hint).font(AppFont.text(13)).foregroundColor(p.inkSoft)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 40)
                    }
                }
                .overlay(Rectangle().strokeBorder(uploadedURL.isEmpty ? p.line : p.ink, style: StrokeStyle(lineWidth: 1, dash: [3, 3])))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(busy)
            ErrorText(text: error)
        }
        .confirmationDialog(title, isPresented: $askSource, titleVisibility: .visible) {
            Button("Сделать фото") { camera = true }
            Button("Выбрать из галереи") { showLibrary = true }
            Button("Отмена", role: .cancel) {}
        }
        .fullScreenCover(isPresented: $camera) {
            CameraPicker { img in Task { await handle(img) } }.ignoresSafeArea()
        }
        .photosPicker(isPresented: $showLibrary, selection: $libraryItem, matching: .images)
        .onChange(of: libraryItem) { item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self), let img = UIImage(data: data) {
                    await handle(img)
                }
                libraryItem = nil
            }
        }
    }

    @MainActor
    private func handle(_ img: UIImage) async {
        preview = img
        error = nil
        busy = true
        defer { busy = false }
        guard let data = ImageTools.jpeg(img) else { error = "Не удалось прочитать фото"; return }
        do {
            uploadedURL = try await API.shared.upload(data)
        } catch {
            uploadedURL = ""
            self.error = error.localizedDescription
        }
    }
}
