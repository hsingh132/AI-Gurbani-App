import SwiftUI

struct ContentView: View {
    private let background = Color(red: 15 / 255, green: 11 / 255, blue: 21 / 255)
    private let card = Color(red: 25 / 255, green: 16 / 255, blue: 36 / 255)
    private let accent = Color(red: 167 / 255, green: 139 / 255, blue: 250 / 255)
    private let gold = Color(red: 217 / 255, green: 180 / 255, blue: 91 / 255)

    var body: some View {
        ZStack {
            background.ignoresSafeArea()

            RadialGradient(
                colors: [accent.opacity(0.28), .clear],
                center: .top,
                startRadius: 10,
                endRadius: 280
            )
            .ignoresSafeArea()

            VStack(spacing: 22) {
                Spacer()

                Text("ੴ")
                    .font(.system(size: 64))
                    .foregroundStyle(gold)
                    .accessibilityLabel("Ik Onkar")

                VStack(spacing: 8) {
                    Text("Gurbani Khoj AI")
                        .font(.largeTitle.bold())
                        .foregroundStyle(.white)

                    Text("Find Shabads by Topic")
                        .font(.headline)
                        .foregroundStyle(.white.opacity(0.65))
                }

                HStack(spacing: 12) {
                    Image(systemName: "sparkle.magnifyingglass")
                        .foregroundStyle(accent)

                    Text("What topic are you looking for?")
                        .foregroundStyle(.white.opacity(0.5))

                    Spacer()
                }
                .padding(18)
                .background(card)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay {
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(gold.opacity(0.3), lineWidth: 1)
                }

                Text("Native app foundation ready")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.45))

                Spacer()
            }
            .padding(24)
            .frame(maxWidth: 620)
        }
        .preferredColorScheme(.dark)
    }
}

#Preview {
    ContentView()
}
