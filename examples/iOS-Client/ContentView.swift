import SwiftUI
import AppAttestKit

struct ContentView: View {
    @StateObject private var attestationService = AppAttestService.shared
    @State private var assertionCount = 0
    @State private var isLoading = false
    @State private var requestError = false
    @State private var requestErrorText = ""
    @State private var isAttestationSupported = false
    @State private var statusMessage = "Ready to test"
    @State private var userData: UserData?
    
    // Configuration - Update this URL for your server
    private let baseUrl = "http://your-server-url:3001"
    private let userId = "demo-user-\(UUID().uuidString.prefix(8))"
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    VStack(spacing: 10) {
                        Text("🔐 AppAttestKit Demo")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                        
                        Text(baseUrl)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text("User: \(userId)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                    
                    // Status Section
                    VStack(spacing: 15) {
                        HStack {
                            Image(systemName: isAttestationSupported ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .foregroundColor(isAttestationSupported ? .green : .red)
                            Text(isAttestationSupported ? "App Attest Supported" : "App Attest Not Supported")
                                .font(.headline)
                        }
                        
                        Text("Status: \(statusMessage)")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        
                        if assertionCount > 0 {
                            Text("Assertion Count: \(assertionCount)")
                                .font(.title2)
                                .fontWeight(.semibold)
                                .foregroundColor(.blue)
                        }
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                    .shadow(radius: 2)
                    
                    // Action Buttons
                    VStack(spacing: 15) {
                        Button(action: {
                            Task { await testProtectedRoute() }
                        }) {
                            HStack {
                                if isLoading {
                                    ProgressView()
                                        .scaleEffect(0.8)
                                }
                                Image(systemName: "shield.checkered")
                                Text(isLoading ? "Processing..." : "Test Protected Route")
                            }
                            .font(.headline)
                            .foregroundColor(.white)
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(isLoading ? Color.gray : Color.blue)
                            .cornerRadius(10)
                        }
                        .disabled(isLoading || !isAttestationSupported)
                        
                        Button(action: {
                            Task { await testUserData() }
                        }) {
                            HStack {
                                Image(systemName: "person.circle")
                                Text("Fetch User Data")
                            }
                            .font(.headline)
                            .foregroundColor(.white)
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(isLoading ? Color.gray : Color.green)
                            .cornerRadius(10)
                        }
                        .disabled(isLoading || !isAttestationSupported)
                        
                        Button("Clear Attestation") {
                            attestationService.clearAttestation()
                            assertionCount = 0
                            userData = nil
                            statusMessage = "Attestation cleared - will re-attest on next request"
                        }
                        .foregroundColor(.red)
                        .disabled(isLoading)
                    }
                    
                    // User Data Display
                    if let userData = userData {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("👤 User Data")
                                .font(.headline)
                                .foregroundColor(.primary)
                            
                            VStack(alignment: .leading, spacing: 5) {
                                HStack {
                                    Text("Account Type:")
                                    Spacer()
                                    Text(userData.accountType)
                                        .fontWeight(.semibold)
                                }
                                
                                HStack {
                                    Text("Last Login:")
                                    Spacer()
                                    Text(formatDate(userData.lastLogin))
                                        .fontWeight(.semibold)
                                }
                                
                                HStack {
                                    Text("Notifications:")
                                    Spacer()
                                    Text(userData.preferences.notifications ? "Enabled" : "Disabled")
                                        .fontWeight(.semibold)
                                }
                                
                                HStack {
                                    Text("Dark Mode:")
                                    Spacer()
                                    Text(userData.preferences.darkMode ? "On" : "Off")
                                        .fontWeight(.semibold)
                                }
                            }
                        }
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(12)
                    }
                    
                    Spacer()
                }
                .padding()
            }
            .navigationBarHidden(true)
        }
        .onAppear {
            isAttestationSupported = AppAttestService.isSupported()
            if !isAttestationSupported {
                statusMessage = "App Attest not supported on this device"
            }
        }
        .alert("Error", isPresented: $requestError) {
            Button("OK") {
                statusMessage = "Ready to test"
            }
        } message: {
            Text(requestErrorText)
        }
    }
    
    private func testProtectedRoute() async {
        guard isAttestationSupported else {
            requestErrorText = "App Attest is not supported on this device"
            requestError = true
            return
        }
        
        isLoading = true
        statusMessage = "Testing protected route..."
        defer { isLoading = false }
        
        guard let url = URL(string: "\(baseUrl)/api/protectedroute") else {
            requestErrorText = "Invalid server URL configuration"
            requestError = true
            statusMessage = "Configuration error"
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.addValue(userId, forHTTPHeaderField: "user-id")
        request.addValue("ios-demo", forHTTPHeaderField: "client-type")
        
        do {
            let (data, response) = try await attestationService.sendSignedRequest(request: request, userId: userId)
            
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                let result = try JSONDecoder().decode(ProtectedRouteResponse.self, from: data)
                assertionCount = result.assertionsCount
                statusMessage = "✅ Protected route accessed successfully!"
            } else {
                requestErrorText = "Server returned an unexpected response"
                requestError = true
                statusMessage = "Request failed"
            }
            
        } catch let error as AppAttestService.AttestationError {
            requestErrorText = error.localizedDescription
            requestError = true
            statusMessage = "Attestation error"
            print("Attestation error: \(error)")
        } catch let error as AppAttestService.SignedRequestError {
            requestErrorText = error.localizedDescription
            requestError = true
            statusMessage = "Request error"
            print("Request error: \(error)")
        } catch {
            requestErrorText = "An unexpected error occurred. Please try again."
            requestError = true
            statusMessage = "Unexpected error"
            print("Unexpected error: \(error)")
        }
    }
    
    private func testUserData() async {
        guard isAttestationSupported else {
            requestErrorText = "App Attest is not supported on this device"
            requestError = true
            return
        }
        
        isLoading = true
        statusMessage = "Fetching user data..."
        defer { isLoading = false }
        
        guard let url = URL(string: "\(baseUrl)/api/user-data") else {
            requestErrorText = "Invalid server URL configuration"
            requestError = true
            statusMessage = "Configuration error"
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.addValue(userId, forHTTPHeaderField: "user-id")
        request.addValue("ios-demo", forHTTPHeaderField: "client-type")
        
        do {
            let (data, response) = try await attestationService.sendSignedRequest(request: request, userId: userId)
            
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                let result = try JSONDecoder().decode(UserData.self, from: data)
                userData = result
                assertionCount = result.assertionCount
                statusMessage = "✅ User data loaded successfully!"
            } else {
                requestErrorText = "Server returned an unexpected response"
                requestError = true
                statusMessage = "Request failed"
            }
            
        } catch let error as AppAttestService.AttestationError {
            requestErrorText = error.localizedDescription
            requestError = true
            statusMessage = "Attestation error"
            print("Attestation error: \(error)")
        } catch let error as AppAttestService.SignedRequestError {
            requestErrorText = error.localizedDescription
            requestError = true
            statusMessage = "Request error"
            print("Request error: \(error)")
        } catch {
            requestErrorText = "An unexpected error occurred. Please try again."
            requestError = true
            statusMessage = "Unexpected error"
            print("Unexpected error: \(error)")
        }
    }
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.timeStyle = .short
            displayFormatter.dateStyle = .none
            return displayFormatter.string(from: date)
        }
        return dateString
    }
}

// MARK: - Response Models

struct ProtectedRouteResponse: Codable {
    let assertionsCount: Int
    let message: String
    let timestamp: String
    let deviceId: String
}

struct UserData: Codable {
    let userId: String
    let accountType: String
    let lastLogin: String
    let preferences: Preferences
    let assertionCount: Int
    
    struct Preferences: Codable {
        let notifications: Bool
        let darkMode: Bool
    }
}

#Preview {
    ContentView()
}