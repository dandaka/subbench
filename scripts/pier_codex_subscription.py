"""Pier Codex agent variant that permits the ChatGPT subscription endpoint."""

from pier.agents.installed.codex import Codex
from pier.models.agent.network import NetworkAllowlist
from pier.models.agent.install import AgentInstallSpec, InstallStep


class CodexSubscription(Codex):
    def network_allowlist(self) -> NetworkAllowlist:
        upstream = super().network_allowlist()
        return NetworkAllowlist(
            domains=upstream.domains + ["chatgpt.com"],
        )

    def install_spec(self) -> AgentInstallSpec:
        spec = super().install_spec()
        spec.steps.append(
            InstallStep(
                user="agent",
                run=(
                    'export NVM_DIR="$HOME/.nvm"; '
                    '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; '
                    'CODEX_BIN="$(command -v codex)"; '
                    'mv "$CODEX_BIN" "${CODEX_BIN}-real"; '
                    'cat >"$CODEX_BIN" <<\'SH\'\n'
                    "#!/usr/bin/env bash\n"
                    "args=()\n"
                    "while (($#)); do\n"
                    '  if [[ "$1" == "--enable" && "${2:-}" == "unified_exec" ]]; then '
                    "shift 2; continue; fi\n"
                    '  args+=("$1"); shift\n'
                    "done\n"
                    'exec "$(dirname "$0")/codex-real" "${args[@]}"\n'
                    "SH\n"
                    'chmod +x "$CODEX_BIN"'
                ),
            )
        )
        return spec
