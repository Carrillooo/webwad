//
//  FaceIDAppleStyleViews.swift
//  Sapphire Personal
//
//  Registro y autenticación facial con la gramática visual de Face ID de Apple:
//  un anillo de tramos radiales que se encienden según el ángulo de la cabeza,
//  y una tarjeta de autenticación que se despliega desde el notch.
//
//  Nota: esto es reconocimiento por webcam, NO el Face ID de Apple. No hay
//  hardware TrueDepth ni Secure Enclave de por medio. Los textos de la interfaz
//  lo dicen de forma explícita.
//

import SwiftUI

// MARK: - Material adaptativo

/// Aplica Liquid Glass en macOS 26+ y un material del sistema en versiones
/// anteriores, para no depender de una API reciente por estética.
private struct AdaptiveGlass<S: InsettableShape>: ViewModifier {
    let shape: S
    let tint: Color?

    // `ViewModifier.body` no es @ViewBuilder de forma implícita: sin esta
    // anotación, las dos ramas devuelven tipos distintos y no compila.
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(macOS 26.0, *) {
            if let tint {
                content.glassEffect(Glass.regular.tint(tint), in: shape)
            } else {
                content.glassEffect(Glass.regular, in: shape)
            }
        } else {
            content
                .background(.ultraThinMaterial, in: shape)
                .overlay(shape.strokeBorder(Color.primary.opacity(0.12), lineWidth: 1))
        }
    }
}

extension View {
    func adaptiveGlass<S: InsettableShape>(in shape: S, tint: Color? = nil) -> some View {
        modifier(AdaptiveGlass(shape: shape, tint: tint))
    }
}

// MARK: - Geometría de poses

/// Sector angular del anillo asociado a cada pose direccional.
///
/// Los ángulos van en grados con 0° arriba y sentido horario, que es como se
/// leen las marcas del anillo de Face ID.
enum FaceIDPoseGeometry {
    /// Poses que se representan como sector del anillo.
    static let directional: [(bucket: FacePoseBucket, degrees: Double)] = [
        (.up,        0),
        (.tiltRight, 45),
        (.right,     90),
        (.down,      180),
        (.left,      270),
        (.tiltLeft,  315)
    ]

    /// Poses que no son direccionales y se muestran aparte del anillo.
    static let nonDirectional: [FacePoseBucket] = [.center, .closer, .farther]

    /// Semiancho del sector: un tramo pertenece a la pose más cercana.
    static let sectorHalfWidth: Double = 22.5

    /// Devuelve la pose dueña del tramo situado en `degrees`, si hay alguna.
    static func bucket(forTickAt degrees: Double) -> FacePoseBucket? {
        directional.first { entry in
            angularDistance(degrees, entry.degrees) <= sectorHalfWidth
        }?.bucket
    }

    static func angularDistance(_ a: Double, _ b: Double) -> Double {
        let diff = abs(a - b).truncatingRemainder(dividingBy: 360)
        return min(diff, 360 - diff)
    }

    /// Texto en español para cada pose.
    static func hint(for bucket: FacePoseBucket) -> String {
        switch bucket {
        case .center:    return "Centra la cara en el círculo"
        case .left:      return "Gira la cabeza despacio a la izquierda"
        case .right:     return "Gira la cabeza despacio a la derecha"
        case .up:        return "Levanta un poco la barbilla"
        case .down:      return "Baja un poco la barbilla"
        case .tiltLeft:  return "Inclina la cabeza hacia la izquierda"
        case .tiltRight: return "Inclina la cabeza hacia la derecha"
        case .closer:    return "Acércate un poco"
        case .farther:   return "Sepárate un poco"
        }
    }
}

// MARK: - Anillo de tramos

/// Anillo de marcas radiales al estilo del registro de Face ID.
///
/// Cada marca pertenece a un sector; el sector se ilumina cuando su pose ya se
/// ha capturado. Las marcas sin pose asignada quedan tenues y sólo dan estructura.
struct FaceIDPoseRing: View {
    /// `rawValue` de las poses ya capturadas (`CameraController.registrationPoseCaptured`).
    let capturedPoses: Set<String>
    /// Pose que se está pidiendo ahora, para resaltar su sector.
    var targetPose: FacePoseBucket?
    var diameter: CGFloat = 300
    var accent: Color = .accentColor

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let tickCount = 48
    private var tickLength: CGFloat { diameter * 0.075 }
    private var tickWidth: CGFloat { max(2, diameter * 0.011) }
    private var ringRadius: CGFloat { diameter / 2 + tickLength * 0.9 }

    var body: some View {
        ZStack {
            ForEach(0..<tickCount, id: \.self) { index in
                tick(at: index)
            }
        }
        .frame(width: ringRadius * 2, height: ringRadius * 2)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Progreso del registro facial")
        .accessibilityValue("\(capturedPoses.count) de \(FacePoseBucket.allCases.count) posiciones capturadas")
    }

    private func degrees(for index: Int) -> Double {
        Double(index) / Double(tickCount) * 360.0
    }

    @ViewBuilder
    private func tick(at index: Int) -> some View {
        let deg = degrees(for: index)
        let owner = FaceIDPoseGeometry.bucket(forTickAt: deg)
        let isCaptured = owner.map { capturedPoses.contains($0.rawValue) } ?? false
        let isTarget = owner != nil && owner == targetPose && !isCaptured

        Capsule()
            .fill(tickColor(captured: isCaptured, target: isTarget, hasOwner: owner != nil))
            .frame(width: tickWidth, height: tickLength * tickScale(captured: isCaptured, target: isTarget))
            .offset(y: -ringRadius + tickLength / 2)
            .rotationEffect(.degrees(deg))
            .animation(
                reduceMotion ? .none : .spring(response: 0.42, dampingFraction: 0.68)
                    .delay(isCaptured ? Double(index % 8) * 0.012 : 0),
                value: isCaptured
            )
    }

    private func tickColor(captured: Bool, target: Bool, hasOwner: Bool) -> Color {
        if captured { return accent }
        if target { return accent.opacity(0.55) }
        return Color.primary.opacity(hasOwner ? 0.22 : 0.10)
    }

    private func tickScale(captured: Bool, target: Bool) -> CGFloat {
        if captured { return 1.35 }
        if target { return 1.15 }
        return 1.0
    }
}

// MARK: - Fases de la autenticación en el notch

/// Fase visible de la autenticación facial, para pintar el notch.
enum FaceIDNotchPhase: Equatable {
    case idle
    /// Buscando una cara en el encuadre.
    case searching
    /// Cara detectada, comprobando identidad y liveness.
    case located
    /// Identidad confirmada.
    case unlocked
    /// No se puede autenticar. El texto explica por qué.
    case failed(String)

    var title: String {
        switch self {
        case .idle:              return ""
        case .searching:         return "Buscando tu cara…"
        case .located:           return "Localizado"
        case .unlocked:          return "Desbloqueado"
        case .failed(let why):   return why
        }
    }

    var symbol: String {
        switch self {
        case .idle, .searching: return "faceid"
        case .located:          return "person.crop.circle.badge.checkmark"
        case .unlocked:         return "lock.open.fill"
        case .failed:           return "exclamationmark.triangle.fill"
        }
    }

    var tint: Color {
        switch self {
        case .idle, .searching: return .accentColor
        case .located:          return .green
        case .unlocked:         return .green
        case .failed:           return .orange
        }
    }
}

extension FaceIDNotchPhase {
    /// Traduce el estado del motor a la fase que se pinta en el notch.
    static func from(state: CameraState, faceIsRecognized: Bool) -> FaceIDNotchPhase {
        switch state {
        case .authenticating, .detecting:
            return faceIsRecognized ? .located : .searching
        case .recognized:
            return .located
        case .needsReenrollment:
            return .failed("Hay que volver a registrar la cara")
        case .idle, .registeredAndIdle, .registering:
            return .idle
        }
    }
}

// MARK: - Autenticación desplegada desde el notch

/// Tarjeta de autenticación facial que se despliega bajo el notch: cámara en
/// vivo, barrido de búsqueda y los estados «Buscando» → «Localizado» →
/// «Desbloqueado».
struct FaceIDNotchAuthView: View {
    @ObservedObject var cameraController: CameraController
    /// Fase forzada desde fuera (por ejemplo `.unlocked` al terminar). Si es
    /// `nil`, se deriva del estado del motor.
    var overridePhase: FaceIDNotchPhase?
    var onCancel: (() -> Void)?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var sweep: CGFloat = 0

    private let previewSize: CGFloat = 96

    private var phase: FaceIDNotchPhase {
        overridePhase ?? FaceIDNotchPhase.from(
            state: cameraController.appState,
            faceIsRecognized: cameraController.faceIsRecognized
        )
    }

    var body: some View {
        HStack(spacing: 16) {
            preview
            VStack(alignment: .leading, spacing: 4) {
                Text(phase.title)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundStyle(.primary)
                    .contentTransition(.opacity)
                    .animation(reduceMotion ? .none : .easeInOut(duration: 0.22), value: phase)

                if case .failed = phase {
                    Text("Usa la contraseña para continuar.")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                } else if phase != .unlocked {
                    Text("Reconocimiento por cámara, no es Face ID de Apple.")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)

            if let onCancel, phase != .unlocked {
                Button(action: onCancel) {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.secondary)
                        .padding(7)
                }
                .buttonStyle(.plain)
                .contentShape(Circle())
                .accessibilityLabel("Cancelar autenticación facial")
                .help("Cancelar")
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .adaptiveGlass(in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Autenticación facial: \(phase.title)")
    }

    private var preview: some View {
        ZStack {
            CameraView(cameraController: cameraController)
                .frame(width: previewSize, height: previewSize)
                .clipShape(Circle())
                .overlay(
                    Circle().strokeBorder(phase.tint.opacity(0.85), lineWidth: 2.5)
                )
                .opacity(phase == .unlocked ? 0 : 1)

            // Barrido de búsqueda: sólo mientras se busca, y nunca con
            // «Reducir movimiento» activado.
            if phase == .searching && !reduceMotion {
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [.clear, phase.tint.opacity(0.75), .clear],
                            startPoint: .leading, endPoint: .trailing
                        )
                    )
                    .frame(width: previewSize, height: 3)
                    .offset(y: sweep)
                    .clipShape(Circle())
                    .onAppear {
                        sweep = -previewSize / 2
                        withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) {
                            sweep = previewSize / 2
                        }
                    }
            }

            if phase == .unlocked || phase == .located {
                Image(systemName: phase.symbol)
                    .font(.system(size: phase == .unlocked ? 40 : 26, weight: .semibold))
                    .foregroundStyle(phase.tint)
                    .transition(reduceMotion ? .opacity : .scale(scale: 0.6).combined(with: .opacity))
            }
        }
        .frame(width: previewSize, height: previewSize)
        .animation(reduceMotion ? .none : .spring(response: 0.38, dampingFraction: 0.72), value: phase)
    }
}

// MARK: - Registro estilo Face ID

/// Registro facial con el anillo de tramos: el usuario mueve la cabeza y cada
/// sector se enciende conforme se capturan los ángulos.
struct FaceIDAppleStyleEnrollmentView: View {
    @ObservedObject var cameraController: CameraController
    let profileName: String
    var onClose: (() -> Void)?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let circleSize: CGFloat = 260

    private var captured: Set<String> { cameraController.registrationPoseCaptured }

    private var isComplete: Bool { cameraController.appState == .registeredAndIdle }

    /// Siguiente pose pendiente, en el mismo orden que usa el motor.
    private var targetPose: FacePoseBucket? {
        let order: [FacePoseBucket] = [.center, .left, .right, .up, .down, .tiltLeft, .tiltRight, .closer, .farther]
        return order.first { !captured.contains($0.rawValue) }
    }

    private var instruction: String {
        if isComplete { return "Registro completado" }
        if let pose = targetPose { return FaceIDPoseGeometry.hint(for: pose) }
        return cameraController.userInstruction
    }

    var body: some View {
        VStack(spacing: 28) {
            header

            ZStack {
                CameraView(cameraController: cameraController)
                    .frame(width: circleSize, height: circleSize)
                    .clipShape(Circle())
                    .overlay(Circle().strokeBorder(Color.primary.opacity(0.10), lineWidth: 1))

                FaceIDPoseRing(
                    capturedPoses: captured,
                    targetPose: targetPose,
                    diameter: circleSize,
                    accent: isComplete ? .green : .accentColor
                )

                if isComplete {
                    Image(systemName: "checkmark")
                        .font(.system(size: 56, weight: .bold))
                        .foregroundStyle(.green)
                        .transition(reduceMotion ? .opacity : .scale(scale: 0.5).combined(with: .opacity))
                }
            }
            .animation(reduceMotion ? .none : .spring(response: 0.4, dampingFraction: 0.75), value: isComplete)

            VStack(spacing: 8) {
                Text(instruction)
                    .font(.system(size: 17, weight: .medium, design: .rounded))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.primary)
                    .animation(reduceMotion ? .none : .easeInOut(duration: 0.2), value: instruction)

                Text("\(captured.count) de \(FacePoseBucket.allCases.count) posiciones")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }

            Text("Reconocimiento por webcam. No es el Face ID de Apple: no usa TrueDepth ni Secure Enclave.")
                .font(.system(size: 11))
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 340)
        }
        .padding(32)
        .frame(minWidth: 420)
        .accessibilityElement(children: .contain)
    }

    private var header: some View {
        HStack {
            Text("Registrando a \(profileName)")
                .font(.system(size: 18, weight: .semibold, design: .rounded))
            Spacer()
            if let onClose {
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Cerrar registro")
            }
        }
    }
}
