"""Pier Claude Code variant using the Node distribution for x86 Docker on Apple Silicon."""

from pier.agents.installed.claude_code import ClaudeCode
from pier.models.agent.install import AgentInstallSpec, InstallStep


class ZaiClaudeCode(ClaudeCode):
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
