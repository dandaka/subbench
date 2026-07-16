"""Pier Claude Code variant for the Anthropic Max subscription.

Uses the Node distribution of Claude Code (needed for x86 Docker on Apple
Silicon), matching the Z.ai variant. Authentication is the native Claude Code
OAuth login, injected by the runner via the ``CLAUDE_CODE_OAUTH_TOKEN``
environment variable; the agent talks to ``api.anthropic.com`` directly, so no
base-URL override is required.
"""

from pier.agents.installed.claude_code import ClaudeCode
from pier.models.agent.network import NetworkAllowlist
from pier.models.agent.install import AgentInstallSpec, InstallStep
from urllib.parse import urlparse


class ClaudeMaxClaudeCode(ClaudeCode):
    def network_allowlist(self) -> NetworkAllowlist:
        # The capture rig is a Docker-hosted, authenticated pass-through proxy.
        # When it is selected, the agent must connect directly to that local hop;
        # Pier's filtered egress proxy would otherwise sit in front of it and
        # reject/loop the host address. The capture proxy remains the only path
        # to Anthropic, and its zero-envelope check is a pre-run gate.
        base_url = self._get_env("ANTHROPIC_BASE_URL")
        if base_url and urlparse(base_url).hostname == "subbench-capture-proxy":
            # Keep Pier's normal task network so the agent can resolve the
            # sidecar. Its NO_PROXY rule sends this one local hop directly to
            # the capture proxy; all external inference remains proxy-owned.
            return NetworkAllowlist(domains=["subbench-capture-proxy"])
        upstream = super().network_allowlist()
        domains = list(upstream.domains)
        for host in ("api.anthropic.com", "platform.claude.com"):
            if host not in domains:
                domains.append(host)
        return NetworkAllowlist(domains=domains)

    def install_spec(self) -> AgentInstallSpec:
        package_version = f"@{self._version}" if self._version else ""
        return AgentInstallSpec(
            agent_name=self.name(),
            version=self._version,
            steps=[
                InstallStep(
                    user="root",
                    env={"DEBIAN_FRONTEND": "noninteractive"},
                    run=(
                        "if command -v apk &> /dev/null; then"
                        "  apk add --no-cache bash nodejs npm;"
                        " elif command -v apt-get &> /dev/null; then"
                        "  apt-get update && apt-get install -y nodejs;"
                        " elif command -v yum &> /dev/null; then"
                        "  yum install -y nodejs;"
                        " fi"
                    ),
                ),
                InstallStep(
                    user="agent",
                    run=(
                        "set -euo pipefail; "
                        'mkdir -p "$HOME/.local"; '
                        f'npm install -g --prefix "$HOME/.local" '
                        f"@anthropic-ai/claude-code{package_version}; "
                        'export PATH="$HOME/.local/bin:$PATH"; '
                        'echo \'export PATH="$HOME/.local/bin:$PATH"\' >> ~/.bashrc; '
                        "claude --version"
                    ),
                ),
            ],
            verification_command=self.get_version_command(),
        )
