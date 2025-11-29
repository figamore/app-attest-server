import SwiftUI
import AppAttestKit

struct ContentView: View {
    // Configuration - Update this URL for your server
    private let baseUrl = "http://server-url:3001"
    private let userId = "demo-user"
    
    @StateObject private var attestationService = AppAttestService.shared
    @State private var assertionCount = 0
    @State private var isLoading = false
    @State private var statusMessage = "Ready"
    
    var body: some View {
        VStack(spacing: 20) {
            Text("AppAttestKit Example")
                .font(.largeTitle)
            
            Text("Status: \(statusMessage)")
                .foregroundColor(.secondary)
            
            if assertionCount > 0 {
                Text("Assertions: \(assertionCount)")
                    .font(.title2)
                    .fontWeight(.bold)
            }
            
            if AppAttestService.isSupported() {
                Button("Send Signed Request") {
                    Task { await sendSecureRequest() }
                }
                .disabled(isLoading)
                .padding()
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(8)
                
                Button("Clear Attestation") {
                    attestationService.clearAttestation()
                    assertionCount = 0
                    statusMessage = "Attestation cleared"
                }
                .foregroundColor(.red)
            } else {
                Text("App Attest not supported")
                    .foregroundColor(.red)
            }
        }
        .padding()
    }
    
    func sendSecureRequest() async {
        isLoading = true
        statusMessage = "Sending request..."
        
        guard let url = URL(string: "\(baseUrl)/api/protectedroute") else {
            statusMessage = "Invalid URL"
            isLoading = false
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.addValue(userId, forHTTPHeaderField: "user-id")
        
        do {
            let (data, _) = try await attestationService.sendSignedRequest(request: request, userId: userId)
            let result = try JSONDecoder().decode(AssertionsCountResponse.self, from: data)
            assertionCount = result.assertionsCount
            statusMessage = "Success!"
        } catch {
            statusMessage = "Error: \(error.localizedDescription)"
            print("Request failed: \(error)")
        }
        
        isLoading = false
    }
}

struct AssertionsCountResponse: Codable {
    let assertionsCount: Int
}

#Preview {
    ContentView()
}