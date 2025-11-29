import SwiftUI
import AppAttestKit

@main
struct AppAttestKitDemoApp: App {
    
    init() {
        configureAppAttestService()
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
    
    private func configureAppAttestService() {
        do {
            // Configure once for the entire app
            try AppAttestService.configure(serverURL: "http://server-url:3001")
            print("✅ AppAttestService configured successfully")
        } catch {
            print("❌ Failed to configure AppAttestService: \(error)")
        }
    }
}