# Bidirectional Disconnect Fix - Diagnostic Steps

## The Problem
When one user hangs up a call, the other user's side still shows the call as ongoing ("Connecting..." or "Active"). The call doesn't properly disconnect on both sides.

## Root Cause
The "call-ended" message from the backend was only being sent to the remote user (to_user_id), but the logic flow needed improvement to ensure proper message routing and callback invocation.

## Fixes Applied

### 1. Backend Fix (server.py)
- Ensured the backend sends the "call-ended" message to the remote user when it receives an "end-call" message
- Sends the call log to BOTH users so both see the completed call

### 2. Frontend Logging (useWebRTC.js & useWebSocket.js)
- Added detailed console logs at every step of the disconnect process:
  - `[endCall]` logs when endCall is triggered
  - `[PC-STATE]` logs for peer connection state changes
  - `[CALL-ENDED]` logs when remote call-ended message is received
  - `[WebSocket]` logs for message routing

## Message Flow Diagram

```
User A clicks hang up
  ↓
User A's endCall() called
  ↓
endCall sends "end-call" message to backend
  ↓
Backend receives "end-call"
  ↓
Backend sends "call-ended" message to User B
  ↓
User B receives "call-ended" message
  ↓
useWebSocket routes to handleCallEnded
  ↓
handleCallEnded calls endCall(true)
  ↓
User B's UI returns to chat, shows completed call log
```

## Testing Procedure

1. **Open browser console (F12)** and go to the Console tab
2. **Start a call between two users**
   - Look for: `[CALL-LOG] Received call-log message` with `status: "ongoing"`
3. **User A clicks hang up**
   - Look for: `[endCall] Called with skipNotify: false`
   - Look for: `[endCall] Sending end-call message to remote user`
4. **Check User B's console**
   - Look for: `[WebSocket] Received message type: call-ended`
   - Look for: `[WebSocket] Calling handler for type: call-ended`
   - Look for: `[CALL-ENDED] Remote user ended the call`
   - Look for: `[endCall] Called with skipNotify: true`
5. **Both users should see**:
   - Call state returns to "idle"
   - Call UI closes
   - Completed call log appears in chat with duration

## Key Console Logs to Watch

| Step | Expected Log | What It Means |
|------|--------------|--------------|
| Call starts | `[CALL-LOG] Received call-log message` | Call initiated successfully |
| User hangs up | `[endCall] Called with skipNotify: false` | Local user ending call, will notify remote |
| Backend processes | `[END-CALL] Sending call-ended to ...` | Server sending disconnect to remote user |
| Remote receives | `[WebSocket] Calling handler for type: call-ended` | Message successfully routed to handler |
| Remote disconnects | `[CALL-ENDED] Remote user ended the call` | handleCallEnded triggered |
| Remote cleanup | `[endCall] Called with skipNotify: true` | Remote user cleaning up without resending message |

## If It's Still Not Working

Check for these issues:

1. **Handler not registered**: Look for `[WebRTC] Registered handlers:` - should list "call-ended"
2. **Message not routed**: Look for `[WebSocket] No handler registered for type: call-ended` - means window.webrtcHandlers wasn't set
3. **Message not received**: Look for `[WebSocket] Received message type: call-ended` - if not present, backend not sending
4. **Backend logs**: Check backend terminal/logs for `[END-CALL] Sending call-ended to ...`

## Implementation Details

### useWebRTC.js Changes
- `endCall()` now logs when called with skipNotify flag
- `handleCallEnded()` logs when receiving remote disconnect
- Connection state changes logged with `[PC-STATE]` prefix

### useWebSocket.js Changes
- Message handler invocation logged with `[WebSocket]` prefix
- Shows if handler is registered or missing

### server.py Changes
- `end-call` handler logs message sending with `[END-CALL]` prefix
- Messages always sent to remote user's ID from to_user_id field
