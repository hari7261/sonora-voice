export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agent Test' };

const DEFAULT_AGENT_ID = 'aa4b2286-45c1-459b-ade4-09bd1a272c1f';

export default async function TestPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const agentId =
    id && /^[a-f0-9-]{36}$/i.test(id) ? id : DEFAULT_AGENT_ID;

  return (
    <div className="container" style={{ padding: '48px 24px' }}>
      <h1>Agent Test Page</h1>
      <p>
        Click the <strong>chat bubble</strong> in the bottom-right corner to
        talk to your AI agent.
      </p>
      <p className="micro muted">
        Agent ID: <code>{agentId}</code> — served from localhost so the
        widget&apos;s origin check passes.
      </p>
      <script src="/widget.js" data-agent-id={agentId} async />
    </div>
  );
}
