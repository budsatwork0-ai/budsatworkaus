import { useState } from "react";

const COLORS = {
  primary: "#4F46E5",
  primaryLight: "#EEF2FF",
  accent: "#10B981",
  accentLight: "#ECFDF5",
  warn: "#F59E0B",
  danger: "#EF4444",
  bg: "#F8F9FB",
  card: "#FFFFFF",
  text: "#1E293B",
  subtext: "#64748B",
  border: "#E2E8F0",
  navBg: "#FFFFFF",
};

const EMPLOYEES = [
  { id: 1, name: "Alex Rivera", role: "Product Manager", dept: "Product", avatar: "AR", color: "#6366F1", status: "online", location: "Austin, TX" },
  { id: 2, name: "Jordan Lee", role: "Senior Engineer", dept: "Engineering", avatar: "JL", color: "#10B981", status: "online", location: "Remote" },
  { id: 3, name: "Sam Patel", role: "UX Designer", dept: "Design", avatar: "SP", color: "#F59E0B", status: "away", location: "NYC" },
  { id: 4, name: "Taylor Kim", role: "Marketing Lead", dept: "Marketing", avatar: "TK", color: "#EF4444", status: "offline", location: "Chicago, IL" },
  { id: 5, name: "Morgan Chen", role: "Data Analyst", dept: "Analytics", avatar: "MC", color: "#8B5CF6", status: "online", location: "San Francisco, CA" },
  { id: 6, name: "Casey Brooks", role: "Sales Rep", dept: "Sales", avatar: "CB", color: "#EC4899", status: "online", location: "Remote" },
  { id: 7, name: "Drew Santos", role: "DevOps Engineer", dept: "Engineering", avatar: "DS", color: "#0EA5E9", status: "away", location: "Seattle, WA" },
  { id: 8, name: "Riley Nguyen", role: "Customer Success", dept: "Support", avatar: "RN", color: "#14B8A6", status: "online", location: "Austin, TX" },
];

const MESSAGES = [
  { id: 1, channel: "#general", from: "Alex Rivera", avatar: "AR", color: "#6366F1", text: "Hey team! Reminder about the all-hands tomorrow at 10am 🎉", time: "9:14 AM", unread: 3 },
  { id: 2, channel: "#engineering", from: "Jordan Lee", avatar: "JL", color: "#10B981", text: "PR #247 is ready for review — new auth flow", time: "8:52 AM", unread: 1 },
  { id: 3, channel: "#design", from: "Sam Patel", avatar: "SP", color: "#F59E0B", text: "Posted the new component library to Figma ✨", time: "Yesterday", unread: 0 },
  { id: 4, channel: "#announcements", from: "Taylor Kim", avatar: "TK", color: "#EF4444", text: "Q2 results are in — we hit 108% of target!", time: "Yesterday", unread: 0 },
  { id: 5, channel: "Morgan Chen", avatar: "MC", color: "#8B5CF6", text: "Can you send over the dashboard numbers?", time: "Mon", unread: 2, isDM: true },
];

const CHAT_MESSAGES = [
  { from: "Alex Rivera", avatar: "AR", color: "#6366F1", text: "Hey team! Reminder about the all-hands tomorrow at 10am 🎉", time: "9:14 AM", mine: false },
  { from: "Jordan Lee", avatar: "JL", color: "#10B981", text: "Thanks for the heads up! Will there be a recording?", time: "9:16 AM", mine: false },
  { from: "You", text: "Yes, we always record and post it to Confluence 👍", time: "9:17 AM", mine: true },
  { from: "Sam Patel", avatar: "SP", color: "#F59E0B", text: "Perfect. Also adding the design updates to the agenda.", time: "9:20 AM", mine: false },
  { from: "You", text: "Great! Looking forward to it", time: "9:21 AM", mine: true },
];

const NEWS = [
  { id: 1, category: "Announcement", title: "Q2 Results: 108% of Target!", body: "Thanks to the whole team's amazing work, we've exceeded our Q2 goals. Details in the all-hands tomorrow.", author: "Taylor Kim", avatar: "TK", color: "#EF4444", time: "2h ago", emoji: "🎯", likes: 24, comments: 7 },
  { id: 2, category: "New Hire", title: "Welcome Riley Nguyen!", body: "Please welcome Riley to the Customer Success team. They're joining us from Zendesk and based in Austin.", author: "Alex Rivera", avatar: "AR", color: "#6366F1", time: "1d ago", emoji: "👋", likes: 31, comments: 12 },
  { id: 3, category: "Product", title: "v2.4 Shipped to Production", body: "The new auth flow and dashboard improvements are now live. Big thanks to engineering!", author: "Jordan Lee", avatar: "JL", color: "#10B981", time: "2d ago", emoji: "🚀", likes: 18, comments: 5 },
  { id: 4, category: "Culture", title: "Team Lunch This Friday!", body: "We're doing a team lunch at Torchy's Tacos on Friday at noon. RSVP in the form below.", author: "Casey Brooks", avatar: "CB", color: "#EC4899", time: "3d ago", emoji: "🌮", likes: 42, comments: 15 },
];

const TASKS = [
  { id: 1, title: "Review PR #247", assignee: "Jordan Lee", due: "Today", priority: "high", done: false },
  { id: 2, title: "Update Q2 deck for all-hands", assignee: "You", due: "Tomorrow", priority: "high", done: false },
  { id: 3, title: "Sync with Morgan on analytics", assignee: "You", due: "This week", priority: "medium", done: false },
  { id: 4, title: "Send onboarding docs to Riley", assignee: "Alex Rivera", due: "This week", priority: "low", done: true },
  { id: 5, title: "Finalize component library", assignee: "Sam Patel", due: "Fri", priority: "medium", done: false },
];

const StatusDot = ({ status }) => {
  const colors = { online: "#10B981", away: "#F59E0B", offline: "#94A3B8" };
  return (
    <span style={{
      display: "inline-block", width: 9, height: 9, borderRadius: "50%",
      background: colors[status] || colors.offline,
      border: "2px solid #fff", flexShrink: 0
    }} />
  );
};

const Avatar = ({ initials, color, size = 40, status }) => (
  <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color + "22",
      color, fontWeight: 700, fontSize: size * 0.36,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      border: `2px solid ${color}33`
    }}>
      {initials}
    </div>
    {status && (
      <div style={{ position: "absolute", bottom: 1, right: 1 }}>
        <StatusDot status={status} />
      </div>
    )}
  </div>
);

const Badge = ({ count }) => count > 0 ? (
  <div style={{
    background: COLORS.primary, color: "#fff", borderRadius: 99, minWidth: 18, height: 18,
    fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
    padding: "0 5px"
  }}>{count}</div>
) : null;

const PriorityChip = ({ priority }) => {
  const map = { high: ["#FEE2E2", "#EF4444"], medium: ["#FEF3C7", "#F59E0B"], low: ["#DCFCE7", "#16A34A"] };
  const [bg, fg] = map[priority] || map.low;
  return (
    <span style={{ background: bg, color: fg, borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
      {priority}
    </span>
  );
};

// ──────────────────────────────────────────────
// SCREENS
// ──────────────────────────────────────────────

function HomeScreen({ navigate }) {
  const onlineCount = EMPLOYEES.filter(e => e.status === "online").length;
  return (
    <div style={{ padding: "0 0 24px" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ color: COLORS.subtext, fontSize: 13, margin: "0 0 2px" }}>Good morning,</p>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: COLORS.text }}>Jackson 👋</h2>
          </div>
          <div style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("messages")}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: COLORS.primaryLight,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18
            }}>💬</div>
            <div style={{
              position: "absolute", top: -4, right: -4, background: COLORS.danger,
              color: "#fff", width: 16, height: 16, borderRadius: 99, fontSize: 10,
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700
            }}>6</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12, padding: "0 20px", marginBottom: 24 }}>
        {[
          { label: "Online Now", value: onlineCount, icon: "🟢", bg: COLORS.accentLight, color: COLORS.accent },
          { label: "My Tasks", value: TASKS.filter(t => !t.done && t.assignee === "You").length, icon: "✅", bg: "#FEF3C7", color: "#D97706" },
          { label: "Unread", value: 6, icon: "📬", bg: COLORS.primaryLight, color: COLORS.primary },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: s.bg, borderRadius: 14, padding: "12px 10px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4
          }}>
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 600, textAlign: "center" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ padding: "0 20px", marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: COLORS.text }}>Quick Actions</h3>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "Directory", icon: "👥", screen: "directory" },
            { label: "Messages", icon: "💬", screen: "messages" },
            { label: "News Feed", icon: "📰", screen: "news" },
            { label: "My Tasks", icon: "✅", screen: "tasks" },
          ].map(a => (
            <div key={a.label} onClick={() => navigate(a.screen)} style={{
              flex: 1, background: COLORS.card, borderRadius: 14, padding: "12px 6px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              border: `1px solid ${COLORS.border}`, cursor: "pointer",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)"
            }}>
              <div style={{ fontSize: 22 }}>{a.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.subtext, textAlign: "center" }}>{a.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Today's tasks */}
      <div style={{ padding: "0 20px", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.text }}>My Tasks</h3>
          <span onClick={() => navigate("tasks")} style={{ fontSize: 13, color: COLORS.primary, fontWeight: 600, cursor: "pointer" }}>See all</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {TASKS.filter(t => t.assignee === "You" && !t.done).map(task => (
            <div key={task.id} style={{
              background: COLORS.card, borderRadius: 12, padding: "12px 14px",
              display: "flex", alignItems: "center", gap: 12,
              border: `1px solid ${COLORS.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
            }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${COLORS.border}`, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text, marginBottom: 2 }}>{task.title}</div>
                <div style={{ fontSize: 12, color: COLORS.subtext }}>Due {task.due}</div>
              </div>
              <PriorityChip priority={task.priority} />
            </div>
          ))}
        </div>
      </div>

      {/* Who's online */}
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.text }}>Who's Online</h3>
          <span onClick={() => navigate("directory")} style={{ fontSize: 13, color: COLORS.primary, fontWeight: 600, cursor: "pointer" }}>View all</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {EMPLOYEES.filter(e => e.status === "online").slice(0, 5).map(emp => (
            <div key={emp.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <Avatar initials={emp.avatar} color={emp.color} size={44} status={emp.status} />
              <div style={{ fontSize: 11, color: COLORS.subtext, fontWeight: 500, textAlign: "center", maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emp.name.split(" ")[0]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DirectoryScreen() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = EMPLOYEES.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase()) ||
    e.dept.toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    return (
      <div style={{ padding: "0 0 24px" }}>
        <div style={{ padding: "20px 20px 0", marginBottom: 20 }}>
          <button onClick={() => setSelected(null)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: COLORS.primary, fontWeight: 600, fontSize: 15, padding: 0,
            display: "flex", alignItems: "center", gap: 4
          }}>← Back</button>
        </div>
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 24 }}>
          <Avatar initials={selected.avatar} color={selected.color} size={80} status={selected.status} />
          <h2 style={{ margin: "14px 0 4px", fontSize: 22, fontWeight: 800, color: COLORS.text }}>{selected.name}</h2>
          <p style={{ margin: "0 0 4px", color: COLORS.subtext, fontSize: 15 }}>{selected.role}</p>
          <span style={{ background: COLORS.primaryLight, color: COLORS.primary, borderRadius: 99, padding: "3px 12px", fontSize: 13, fontWeight: 600 }}>{selected.dept}</span>
        </div>
        <div style={{ padding: "0 20px", display: "flex", gap: 10, justifyContent: "center", marginBottom: 28 }}>
          {[{ icon: "💬", label: "Message" }, { icon: "📞", label: "Call" }, { icon: "📧", label: "Email" }].map(a => (
            <div key={a.label} style={{
              background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14,
              padding: "10px 16px", display: "flex", flexDirection: "column", alignItems: "center",
              gap: 5, cursor: "pointer", flex: 1
            }}>
              <span style={{ fontSize: 20 }}>{a.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.subtext }}>{a.label}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "0 20px" }}>
          {[
            { label: "Department", value: selected.dept },
            { label: "Location", value: selected.location },
            { label: "Status", value: selected.status.charAt(0).toUpperCase() + selected.status.slice(1) },
          ].map(row => (
            <div key={row.label} style={{
              display: "flex", justifyContent: "space-between", padding: "14px 0",
              borderBottom: `1px solid ${COLORS.border}`
            }}>
              <span style={{ color: COLORS.subtext, fontSize: 14 }}>{row.label}</span>
              <span style={{ color: COLORS.text, fontWeight: 600, fontSize: 14 }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 24px" }}>
      <div style={{ padding: "20px 20px 0", marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 22, fontWeight: 800, color: COLORS.text }}>Directory</h2>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: "10px 14px"
        }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input
            placeholder="Search by name, role, dept..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: "none", outline: "none", flex: 1, fontSize: 14, color: COLORS.text, background: "transparent" }}
          />
        </div>
      </div>
      <div style={{ padding: "0 20px" }}>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: COLORS.subtext }}>{filtered.length} people</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(emp => (
            <div key={emp.id} onClick={() => setSelected(emp)} style={{
              background: COLORS.card, borderRadius: 14, padding: "12px 14px",
              display: "flex", alignItems: "center", gap: 12,
              border: `1px solid ${COLORS.border}`, cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
            }}>
              <Avatar initials={emp.avatar} color={emp.color} size={44} status={emp.status} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{emp.name}</div>
                <div style={{ fontSize: 13, color: COLORS.subtext }}>{emp.role} · {emp.dept}</div>
              </div>
              <span style={{ fontSize: 18, color: COLORS.subtext }}>›</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessagesScreen() {
  const [activeChannel, setActiveChannel] = useState(null);
  const [draft, setDraft] = useState("");

  if (activeChannel) {
    const msg = MESSAGES.find(m => m.id === activeChannel);
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 10, background: COLORS.card }}>
          <button onClick={() => setActiveChannel(null)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: COLORS.primary, fontWeight: 600, fontSize: 15, padding: 0
          }}>←</button>
          <Avatar initials={msg.avatar} color={msg.color} size={34} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{msg.channel}</div>
            <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 600 }}>● Active now</div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {CHAT_MESSAGES.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: m.mine ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}>
              {!m.mine && <Avatar initials={m.avatar} color={m.color} size={28} />}
              <div style={{ maxWidth: "72%" }}>
                {!m.mine && <div style={{ fontSize: 11, color: COLORS.subtext, marginBottom: 3, fontWeight: 600 }}>{m.from}</div>}
                <div style={{
                  background: m.mine ? COLORS.primary : COLORS.card,
                  color: m.mine ? "#fff" : COLORS.text,
                  borderRadius: m.mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding: "10px 14px", fontSize: 14, lineHeight: 1.5,
                  border: m.mine ? "none" : `1px solid ${COLORS.border}`
                }}>{m.text}</div>
                <div style={{ fontSize: 10, color: COLORS.subtext, marginTop: 3, textAlign: m.mine ? "right" : "left" }}>{m.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.card, display: "flex", gap: 10, alignItems: "center" }}>
          <input
            placeholder="Message..."
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{
              flex: 1, background: COLORS.bg, border: `1px solid ${COLORS.border}`,
              borderRadius: 20, padding: "10px 16px", fontSize: 14,
              outline: "none", color: COLORS.text
            }}
          />
          <button style={{
            width: 38, height: 38, borderRadius: "50%", border: "none",
            background: COLORS.primary, color: "#fff", fontSize: 16,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
          }}>➤</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 24px" }}>
      <div style={{ padding: "20px 20px 0", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: COLORS.text }}>Messages</h2>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: COLORS.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer" }}>✏️</div>
        </div>
      </div>
      <div style={{ padding: "0 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["All", "DMs", "Channels"].map((t, i) => (
            <div key={t} style={{
              padding: "6px 14px", borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: i === 0 ? COLORS.primary : COLORS.card,
              color: i === 0 ? "#fff" : COLORS.subtext,
              border: `1px solid ${i === 0 ? COLORS.primary : COLORS.border}`
            }}>{t}</div>
          ))}
        </div>
      </div>
      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 2 }}>
        {MESSAGES.map(msg => (
          <div key={msg.id} onClick={() => setActiveChannel(msg.id)} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
            borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer"
          }}>
            <Avatar initials={msg.avatar} color={msg.color} size={46} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontWeight: msg.unread > 0 ? 800 : 600, fontSize: 15, color: COLORS.text }}>{msg.channel}</span>
                <span style={{ fontSize: 12, color: COLORS.subtext }}>{msg.time}</span>
              </div>
              <div style={{ fontSize: 13, color: msg.unread > 0 ? COLORS.text : COLORS.subtext, fontWeight: msg.unread > 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {!msg.isDM && <span style={{ color: COLORS.subtext, fontWeight: 500 }}>{msg.from}: </span>}
                {msg.text}
              </div>
            </div>
            {msg.unread > 0 && <Badge count={msg.unread} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsScreen() {
  const [liked, setLiked] = useState({});

  return (
    <div style={{ padding: "0 0 24px" }}>
      <div style={{ padding: "20px 20px 0", marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: COLORS.text }}>Company News</h2>
        <p style={{ margin: 0, color: COLORS.subtext, fontSize: 14 }}>What's happening at Buds at Work</p>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "0 20px", marginBottom: 20, overflowX: "auto" }}>
        {["All", "Announcements", "New Hires", "Product", "Culture"].map((t, i) => (
          <div key={t} style={{
            padding: "6px 14px", borderRadius: 99, fontSize: 13, fontWeight: 600,
            background: i === 0 ? COLORS.primary : COLORS.card,
            color: i === 0 ? "#fff" : COLORS.subtext,
            border: `1px solid ${i === 0 ? COLORS.primary : COLORS.border}`,
            whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0
          }}>{t}</div>
        ))}
      </div>
      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {NEWS.map(post => (
          <div key={post.id} style={{
            background: COLORS.card, borderRadius: 16, padding: 16,
            border: `1px solid ${COLORS.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{
                background: COLORS.primaryLight, color: COLORS.primary,
                borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 700
              }}>{post.category}</span>
              <span style={{ fontSize: 11, color: COLORS.subtext, marginLeft: "auto" }}>{post.time}</span>
            </div>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{post.emoji}</div>
            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: COLORS.text }}>{post.title}</h3>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: COLORS.subtext, lineHeight: 1.6 }}>{post.body}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 10, borderTop: `1px solid ${COLORS.border}` }}>
              <Avatar initials={post.avatar} color={post.color} size={24} />
              <span style={{ fontSize: 13, color: COLORS.subtext, flex: 1 }}>{post.author}</span>
              <button onClick={() => setLiked(l => ({ ...l, [post.id]: !l[post.id] }))} style={{
                background: "none", border: "none", cursor: "pointer", fontSize: 14,
                display: "flex", alignItems: "center", gap: 4,
                color: liked[post.id] ? COLORS.danger : COLORS.subtext, fontWeight: 600
              }}>
                {liked[post.id] ? "❤️" : "🤍"} {post.likes + (liked[post.id] ? 1 : 0)}
              </button>
              <span style={{ color: COLORS.subtext, fontSize: 14 }}>💬 {post.comments}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksScreen() {
  const [tasks, setTasks] = useState(TASKS);

  const toggle = (id) => setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);

  return (
    <div style={{ padding: "0 0 24px" }}>
      <div style={{ padding: "20px 20px 0", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: COLORS.text }}>Tasks</h2>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: COLORS.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer" }}>+</div>
        </div>
        <div style={{ marginTop: 14, background: COLORS.border, borderRadius: 99, height: 8, overflow: "hidden" }}>
          <div style={{ background: COLORS.accent, width: `${(done.length / tasks.length) * 100}%`, height: "100%", borderRadius: 99, transition: "width 0.3s" }} />
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: COLORS.subtext }}>{done.length} of {tasks.length} tasks complete</p>
      </div>

      <div style={{ padding: "0 20px" }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: COLORS.subtext, textTransform: "uppercase", letterSpacing: 0.5 }}>Open · {open.length}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {open.map(task => (
            <div key={task.id} onClick={() => toggle(task.id)} style={{
              background: COLORS.card, borderRadius: 12, padding: "12px 14px",
              display: "flex", alignItems: "center", gap: 12,
              border: `1px solid ${COLORS.border}`, cursor: "pointer"
            }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${COLORS.border}`, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text, marginBottom: 2 }}>{task.title}</div>
                <div style={{ fontSize: 12, color: COLORS.subtext }}>{task.assignee} · Due {task.due}</div>
              </div>
              <PriorityChip priority={task.priority} />
            </div>
          ))}
        </div>

        {done.length > 0 && <>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: COLORS.subtext, textTransform: "uppercase", letterSpacing: 0.5 }}>Completed · {done.length}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {done.map(task => (
              <div key={task.id} onClick={() => toggle(task.id)} style={{
                background: COLORS.card, borderRadius: 12, padding: "12px 14px",
                display: "flex", alignItems: "center", gap: 12, opacity: 0.6,
                border: `1px solid ${COLORS.border}`, cursor: "pointer"
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6, background: COLORS.accent,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, color: "#fff", fontSize: 12, fontWeight: 700
                }}>✓</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, color: COLORS.subtext, textDecoration: "line-through" }}>{task.title}</div>
                </div>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

function ProfileScreen() {
  const me = { name: "Jackson Taylor", role: "Product Manager", dept: "Product", avatar: "JT", color: "#4F46E5", status: "online", location: "Austin, TX", email: "supermancapes56@gmail.com" };

  return (
    <div style={{ padding: "0 0 24px" }}>
      <div style={{ padding: "20px 20px 0", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: COLORS.text }}>Profile</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px 24px", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 20 }}>
        <Avatar initials={me.avatar} color={me.color} size={80} status={me.status} />
        <h2 style={{ margin: "14px 0 4px", fontSize: 20, fontWeight: 800, color: COLORS.text }}>{me.name}</h2>
        <p style={{ margin: "0 0 8px", color: COLORS.subtext }}>{me.role} · {me.dept}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <StatusDot status="online" />
          <span style={{ fontSize: 13, color: COLORS.accent, fontWeight: 600 }}>Online</span>
        </div>
      </div>
      <div style={{ padding: "0 20px" }}>
        {[
          { icon: "📍", label: "Location", value: me.location },
          { icon: "📧", label: "Email", value: me.email },
          { icon: "🏢", label: "Department", value: me.dept },
        ].map(row => (
          <div key={row.label} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px 0",
            borderBottom: `1px solid ${COLORS.border}`
          }}>
            <span style={{ fontSize: 18 }}>{row.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: COLORS.subtext, fontWeight: 500 }}>{row.label}</div>
              <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 600, marginTop: 1 }}>{row.value}</div>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          {["Notification Settings", "Privacy & Security", "Appearance", "Help & Support"].map(item => (
            <div key={item} style={{
              background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12,
              padding: "14px 16px", display: "flex", justifyContent: "space-between",
              alignItems: "center", cursor: "pointer"
            }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: COLORS.text }}>{item}</span>
              <span style={{ color: COLORS.subtext }}>›</span>
            </div>
          ))}
        </div>

        <button style={{
          width: "100%", marginTop: 20, padding: "14px", borderRadius: 12, border: "none",
          background: "#FEE2E2", color: COLORS.danger, fontWeight: 700, fontSize: 15, cursor: "pointer"
        }}>Sign Out</button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// ROOT
// ──────────────────────────────────────────────

const NAV = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "directory", label: "People", icon: "👥" },
  { id: "messages", label: "Messages", icon: "💬", badge: 6 },
  { id: "news", label: "News", icon: "📰" },
  { id: "profile", label: "Profile", icon: "👤" },
];

export default function App() {
  const [screen, setScreen] = useState("home");

  const SCREENS = {
    home: <HomeScreen navigate={setScreen} />,
    directory: <DirectoryScreen />,
    messages: <MessagesScreen />,
    news: <NewsScreen />,
    tasks: <TasksScreen />,
    profile: <ProfileScreen />,
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#E2E8F0",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 20
    }}>
      {/* Phone shell */}
      <div style={{
        width: 390, maxWidth: "100%",
        background: COLORS.bg, borderRadius: 44,
        boxShadow: "0 30px 80px rgba(0,0,0,0.25), 0 0 0 8px #1E293B, 0 0 0 10px #334155",
        overflow: "hidden", display: "flex", flexDirection: "column",
        height: 780, maxHeight: "95vh", position: "relative"
      }}>
        {/* Status bar */}
        <div style={{
          background: COLORS.card, padding: "10px 24px 6px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 12, fontWeight: 700, color: COLORS.text, flexShrink: 0
        }}>
          <span>9:41 AM</span>
          <div style={{ width: 80, height: 16, background: "#1E293B", borderRadius: 99 }} />
          <div style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 14 }}>
            <span>●●●</span>
            <span>🔋</span>
          </div>
        </div>

        {/* App header bar */}
        <div style={{
          background: COLORS.card, padding: "10px 20px 10px",
          borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
          display: "flex", alignItems: "center", gap: 10
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🌿</div>
          <span style={{ fontWeight: 800, fontSize: 17, color: COLORS.text }}>Buds at Work</span>
        </div>

        {/* Screen content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {SCREENS[screen] || SCREENS.home}
        </div>

        {/* Bottom nav */}
        <div style={{
          background: COLORS.navBg, borderTop: `1px solid ${COLORS.border}`,
          display: "flex", padding: "8px 0 16px", flexShrink: 0
        }}>
          {NAV.map(tab => (
            <button key={tab.id} onClick={() => setScreen(tab.id)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 0",
              position: "relative"
            }}>
              {tab.badge && screen !== tab.id && (
                <div style={{
                  position: "absolute", top: -2, right: "calc(50% - 18px)",
                  background: COLORS.danger, color: "#fff",
                  width: 14, height: 14, borderRadius: 99, fontSize: 9,
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700
                }}>{tab.badge}</div>
              )}
              <span style={{ fontSize: 20 }}>{tab.icon}</span>
              <span style={{
                fontSize: 10, fontWeight: screen === tab.id ? 700 : 500,
                color: screen === tab.id ? COLORS.primary : COLORS.subtext
              }}>{tab.label}</span>
              {screen === tab.id && (
                <div style={{ width: 4, height: 4, borderRadius: 99, background: COLORS.primary, position: "absolute", bottom: -4 }} />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
