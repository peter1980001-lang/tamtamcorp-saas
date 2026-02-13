export default function AdminHome() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Admin</h1>
      <ul>
        <li><a href="/admin/inbox">Global Inbox</a></li>
        <li><a href="/admin/companies">Companies</a></li>
      </ul>
    </div>
  );
}
