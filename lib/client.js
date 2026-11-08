window.__ModuleLoader__.load({
	id: "dsh-plugin-conversation-delete",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const { jsx, jsxs } = require("react/jsx-runtime");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		/** Locale namespace of this plugin. */
		const NS = "session-delete";
		/** The Host route registered by lib/index.js. */
		const ROUTE = "/api/session-delete/delete";

		const dictionaries = {
			zh: {
				"action.delete": "删除对话",
				"confirm.title": "删除对话",
				"confirm.description": "将永久删除「{name}」及其全部历史记录。此操作无法撤销。",
				"confirm.delete": "永久删除",
				"confirm.cancel": "取消",
				"confirm.busy": "正在删除…",
				"confirm.close": "关闭",
				"error.live": "该对话仍在 DSH 中打开，请先切换到其他对话再删除。",
				"error.active": "该对话仍在运行：{detail}。请先停止后再删除。",
				"error.notFound": "找不到该对话，可能已被删除。",
				"error.unsupported": "该对话不支持删除（找不到本地日志或路径不匹配）。",
				"error.invalid": "会话 id 无效。",
				"error.failed": "删除失败：{message}",
				"error.unknown": "删除失败，请重试。"
			},
			en: {
				"action.delete": "Delete conversation",
				"confirm.title": "Delete conversation",
				"confirm.description": "Permanently delete “{name}” and its entire history. This cannot be undone.",
				"confirm.delete": "Delete permanently",
				"confirm.cancel": "Cancel",
				"confirm.busy": "Deleting…",
				"confirm.close": "Close",
				"error.live": "This conversation is still open in DSH. Switch to another conversation first.",
				"error.active": "This conversation is still running: {detail}. Stop it first.",
				"error.notFound": "Conversation not found; it may already be deleted.",
				"error.unsupported": "This conversation cannot be deleted (no local log or unexpected path).",
				"error.invalid": "Not a valid session id.",
				"error.failed": "Delete failed: {message}",
				"error.unknown": "Delete failed. Try again."
			}
		};

		/** Host error codes mapped to locale keys. */
		const ERROR_KEYS = {
			live: "error.live",
			active: "error.active",
			"not-found": "error.notFound",
			unsupported: "error.unsupported",
			invalid: "error.invalid"
		};

		/** Pending confirmation: `{ sessionId, title }` or null. */
		let pending = null;
		const listeners = new Set();
		/** Bound translator set during apply; used when the slot does not inject one. */
		let boundT = (key) => key;
		function setPending(next) {
			pending = next;
			for (const listener of listeners) listener();
		}

		function subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}

		function usePending() {
			return React.useSyncExternalStore(subscribe, () => pending);
		}

		/**
		 * Ask the Host to permanently delete one conversation.
		 * @param sessionId - the conversation to delete.
		 * @returns the Host response.
		 */
		async function deleteSession(sessionId) {
			const response = await fetch(ROUTE, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ sessionId })
			});
			let body = null;
			try {
				body = await response.json();
			} catch (_error) {
				body = null;
			}
			if (!response.ok || body === null || body.ok !== true) {
				const code = body && typeof body.code === "string" ? body.code : "";
				const message = body && typeof body.message === "string" ? body.message : `HTTP ${response.status}`;
				throw Object.assign(new Error(message), { code, mapped: ERROR_KEYS[code] });
			}
			return body;
		}

		/**
		 * Overlay entry: one confirmation dialog per pending request.
		 * @param props - the injected locale seat when available.
		 * @returns the open dialog, or null.
		 */
		function ConfirmDialog(props) {
			const t = typeof props.t === "function" ? props.t : boundT;
			const request = usePending();
			const [busy, setBusy] = React.useState(false);
			const [error, setError] = React.useState(null);

			if (request === null) return null;

			const close = () => {
				if (busy) return;
				setError(null);
				setPending(null);
			};

			const confirm = async () => {
				if (busy) return;
				setBusy(true);
				setError(null);
				try {
					await deleteSession(request.sessionId);
					setBusy(false);
					setPending(null);
					window.location.reload();
				} catch (reason) {
					setBusy(false);
					const mapped = reason && typeof reason.mapped === "string" ? reason.mapped : undefined;
					const detail = reason instanceof Error ? reason.message : String(reason);
					setError(mapped === undefined ? t("error.failed", { message: detail }) : t(mapped, { detail }));
				}
			};

			return jsxs(primitives.Modal, {
				open: true,
				onClose: close,
				closeLabel: t("confirm.close"),
				title: t("confirm.title"),
				description: t("confirm.description", { name: request.title || request.sessionId }),
				footer: jsxs(React.Fragment, null, [
					jsx(
						primitives.Button,
						{ variant: "outline", disabled: busy, onClick: close },
						t("confirm.cancel")
					),
					jsx(
						primitives.Button,
						{
							variant: "outline",
							disabled: busy,
							onClick: confirm,
							style: { color: "var(--dsw-alias-state-error-primary, #d92d20)" }
						},
						busy ? t("confirm.busy") : t("confirm.delete")
					)
				]),
				children: jsxs(React.Fragment, null, [
					jsx("div", { "data-session-delete-dialog": "", style: { display: "none" } }),
					error === null
						? null
						: jsx("div", { role: "alert", style: { color: "var(--dsw-alias-state-error-primary, #d92d20)", fontSize: 13, lineHeight: "20px" } }, error)
				])
			});
		}

		exports.inject = ["contextMenus", "slots", "locale"];

		/**
		 * Add the “Delete conversation” row to every Session menu and mount the
		 * confirmation overlay.
		 * @param ctx - Client root context.
		 */
		exports.apply = function apply(ctx) {
			const t = ctx.locale.bind(NS);
			boundT = t;

			ctx.effect(() => ctx.locale.register(NS, dictionaries), "session-delete: dictionaries");

			ctx.effect(
				() =>
					ctx.contextMenus.register({
						id: "session.delete",
						target: "session",
						order: 700,
						resolve: (target) => [
							{
								id: "delete",
								label: t("action.delete"),
								danger: true,
								separatorBefore: true,
								failureLabel: t("error.unknown"),
								run: () => {
									const request = {
										sessionId: target.sessionId,
										title: typeof target.displayTitle === "string" ? target.displayTitle : ""
									};
									const text = t("confirm.description", { name: request.title || request.sessionId });
									// The menu disposes itself and runs its exit transition inside this
									// click. A dialog mounted in the same event would be closed by that
									// teardown, so open on the next task instead.
									window.setTimeout(() => setPending(request), 50);
									// If the overlay entry is unavailable (a host without the slot, or a
									// failed registration), fall back to the native confirmation rather
									// than doing nothing.
									window.setTimeout(() => {
										if (pending !== request) return;
										if (typeof document !== "undefined" && document.querySelector("[data-session-delete-dialog]") !== null) return;
										setPending(null);
										if (!window.confirm(text)) return;
										deleteSession(request.sessionId)
											.then(() => window.location.reload())
											.catch((reason) => {
												const mapped = reason && typeof reason.mapped === "string" ? reason.mapped : undefined;
												const detail = reason instanceof Error ? reason.message : String(reason);
												window.alert(mapped === undefined ? t("error.failed", { message: detail }) : t(mapped, { detail }));
											});
									}, 450);
								}
							}
						]
					}),
				"session-delete: menu contribution"
			);

			ctx.slots.inject("shell.overlay", () =>
				ctx.slots.register(
					{ name: "shell.overlay", id: "session-delete.confirm", locale: NS },
					ConfirmDialog
				)
			);
		};

		return module.exports;
	}
});
