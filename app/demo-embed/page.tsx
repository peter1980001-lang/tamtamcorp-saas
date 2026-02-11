export default function DemoEmbed() {
  return (
    <div style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>Demo Embed Page</h1>
      <p>Unten rechts sollte der Chat Button erscheinen.</p>

      <script
        src="/widget-loader.js"
        data-client="pk_test_123"
        data-host="http://localhost:3000"
        defer
      ></script>
    </div>
  );
}
