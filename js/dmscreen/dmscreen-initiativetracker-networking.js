export class InitiativeTrackerNetworking {
	constructor ({board}) {
		this._board = board;
	}

	/**
	 * @param opts
	 * @param opts.p2pMetaV1
	 * @param opts.doUpdateExternalStates
	 * @param [opts.$btnStartServer]
	 * @param [opts.$btnGetToken]
	 * @param [opts.$btnGetLink]
	 * @param [opts.fnDispServerStoppedState]
	 * @param [opts.fnDispServerRunningState]
	 */
	async startServerV1 (opts) {
		opts = opts || {};

		if (opts.p2pMetaV1.serverPeer) {
			await opts.p2pMetaV1.serverPeer.pInit();
			return true;
		}

		try {
			if (opts.$btnStartServer) opts.$btnStartServer.prop("disabled", true);
			opts.p2pMetaV1.serverPeer = new PeerVeServer();
			await opts.p2pMetaV1.serverPeer.pInit();
			if (opts.$btnGetToken) opts.$btnGetToken.prop("disabled", false);
			if (opts.$btnGetLink) opts.$btnGetLink.prop("disabled", false);

			opts.p2pMetaV1.serverPeer.on("connection", connection => {
				const pConnected = new Promise(resolve => {
					connection.on("open", () => {
						resolve(true);
						opts.doUpdateExternalStates();
					});
				});
				const pTimeout = MiscUtil.pDelay(5 * 1000, false);
				Promise.race([pConnected, pTimeout])
					.then(didConnect => {
						if (!didConnect) {
							JqueryUtil.doToast({content: `Connecting to "${connection.label.escapeQuotes()}" has taken more than 5 seconds! The connection may need to be re-attempted.`, type: "warning"});
						}
					});
			});

			$(window).on("beforeunload", evt => {
				const message = `The connection will be closed`;
				(evt || window.event).message = message;
				return message;
			});

			if (opts.fnDispServerRunningState) opts.fnDispServerRunningState();

			return true;
		} catch (e) {
			if (opts.fnDispServerStoppedState) opts.fnDispServerStoppedState();
			if (opts.$btnStartServer) opts.$btnStartServer.prop("disabled", false);
			opts.p2pMetaV1.serverPeer = null;
			JqueryUtil.doToast({content: `Failed to start server! ${VeCt.STR_SEE_CONSOLE}`, type: "danger"});
			setTimeout(() => { throw e; });
		}

		return false;
	}

	handleClick_playerWindowV1 ({p2pMetaV1, doUpdateExternalStates}) {
		const {$modalInner} = UiUtil.getShowModal({
			title: "Configure Player View",
			isUncappedHeight: true,
			isHeight100: true,
			cbClose: () => {
				if (p2pMetaV1.rows.length) p2pMetaV1.rows.forEach(row => row.$row.detach());
				if (p2pMetaV1.serverPeer) p2pMetaV1.serverPeer.offTemp("connection");
			},
		});

		const $wrpHelp = UiUtil.$getAddModalRow($modalInner, "div");

		const fnDispServerStoppedState = () => {
			$btnStartServer.html(`<span class="glyphicon glyphicon-play"></span> Start Server`).prop("disabled", false);
			$btnGetToken.prop("disabled", true);
			$btnGetLink.prop("disabled", true);
		};

		const fnDispServerRunningState = () => {
			$btnStartServer.html(`<span class="glyphicon glyphicon-play"></span> Server Running`).prop("disabled", true);
			$btnGetToken.prop("disabled", false);
			$btnGetLink.prop("disabled", false);
		};

		const $btnStartServer = $(`<button class="btn btn-default mr-2"></button>`)
			.click(async () => {
				const isRunning = await this.startServerV1({p2pMetaV1, doUpdateExternalStates, $btnStartServer, $btnGetToken, $btnGetLink, fnDispServerStoppedState, fnDispServerRunningState});
				if (isRunning) {
					p2pMetaV1.serverPeer.onTemp("connection", showConnected);
					showConnected();
				}
			});

		const $btnGetToken = $(`<button class="btn btn-default mr-2" disabled><span class="glyphicon glyphicon-copy"></span> Copy Token</button>`).appendTo($wrpHelp)
			.click(() => {
				MiscUtil.pCopyTextToClipboard(p2pMetaV1.serverPeer.token);
				JqueryUtil.showCopiedEffect($btnGetToken);
			});

		const $btnGetLink = $(`<button class="btn btn-default" disabled><span class="glyphicon glyphicon-link"></span> Copy Link</button>`).appendTo($wrpHelp)
			.click(() => {
				const cleanOrigin = window.location.origin.replace(/\/+$/, "");
				const url = `${cleanOrigin}/inittrackerplayerview.html#v1:${p2pMetaV1.serverPeer.token}`;
				MiscUtil.pCopyTextToClipboard(url);
				JqueryUtil.showCopiedEffect($btnGetLink);
			});

		if (p2pMetaV1.serverPeer) fnDispServerRunningState();
		else fnDispServerStoppedState();

		$$`<div class="row w-100">
			<div class="col-12">
				<p>
				The Player View is part of a peer-to-peer system to allow players to connect to a DM's initiative tracker. Players should use the <a href="inittrackerplayerview.html">Initiative Tracker Player View</a> page to connect to the DM's instance. As a DM, the usage is as follows:
				<ol>
					<li>Start the server.</li>
					<li>Copy your link/token and share it with your players.</li>
					<li>Wait for them to connect!</li>
				</ol>
				</p>
				<p>${$btnStartServer}${$btnGetLink}${$btnGetToken}</p>
				<p><i>Please note that this system is highly experimental. Your experience may vary.</i></p>
			</div>
		</div>`.appendTo($wrpHelp);

		UiUtil.addModalSep($modalInner);

		const $wrpConnected = UiUtil.$getAddModalRow($modalInner, "div").addClass("flx-col");

		const showConnected = () => {
			if (!p2pMetaV1.serverPeer) return $wrpConnected.html(`<div class="w-100 ve-flex-vh-center"><i>No clients connected.</i></div>`);

			let stack = `<div class="w-100"><h5>Connected Clients:</h5><ul>`;
			p2pMetaV1.serverPeer.getActiveConnections()
				.map(it => it.label || "(Unknown)")
				.sort(SortUtil.ascSortLower)
				.forEach(it => stack += `<li>${it.escapeQuotes()}</li>`);
			stack += "</ul></div>";
			$wrpConnected.html(stack);
		};

		if (p2pMetaV1.serverPeer) p2pMetaV1.serverPeer.onTemp("connection", showConnected);

		showConnected();
	}

	// nop on receiving a message; we want to send only
	// TODO expand this, to allow e.g. players to set statuses or assign damage/healing (at DM approval?)
	_playerWindowV0_DM_MESSAGE_RECEIVER = function () {};

	_playerWindowV0_DM_ERROR_HANDLER = function (err) {
		if (!this.isClosed) {
			// TODO: this could be better at handling `err.error == "RTCError: User-Initiated Abort, reason=Close called"`
			JqueryUtil.doToast({
				content: `Server error:\n${err ? (err.message || err.error || err) : "(Unknown error)"}`,
				type: "danger",
			});
		}
	};

	async _playerWindowV0_pGetServerTokens ({p2pMetaV0, rowMetas}) {
		const targetRows = rowMetas.filter(it => !it.isDeleted).filter(it => !it.isActive);
		if (targetRows.every(it => it.isActive)) {
			return JqueryUtil.doToast({
				content: "No rows require Server Token generation!",
				type: "warning",
			});
		}

		let anyInvalidNames = false;
		targetRows.forEach(r => {
			r.$iptName.removeClass("error-background");
			if (!r.$iptName.val().trim()) {
				anyInvalidNames = true;
				r.$iptName.addClass("error-background");
			}
		});
		if (anyInvalidNames) return;

		const names = targetRows.map(r => {
			r.isActive = true;

			r.$iptName.attr("disabled", true);
			r.$btnGenServerToken.attr("disabled", true);

			return r.$iptName.val();
		});

		if (p2pMetaV0.serverInfo) {
			await p2pMetaV0.serverInfo;

			const serverInfo = await PeerUtilV0.pInitialiseServersAddToExisting(
				names,
				p2pMetaV0.serverInfo,
				this._playerWindowV0_DM_MESSAGE_RECEIVER,
				this._playerWindowV0_DM_ERROR_HANDLER,
			);

			return targetRows.map((r, i) => {
				r.name = serverInfo[i].name;
				r.serverInfo = serverInfo[i];
				r.$iptTokenServer.val(serverInfo[i].textifiedSdp).attr("disabled", false);

				serverInfo[i].rowMeta = r;

				r.$iptTokenClient.attr("disabled", false);
				r.$btnAcceptClientToken.attr("disabled", false);

				return serverInfo[i].textifiedSdp;
			});
		} else {
			p2pMetaV0.serverInfo = (async () => {
				p2pMetaV0.serverInfo = await PeerUtilV0.pInitialiseServers(names, this._playerWindowV0_DM_MESSAGE_RECEIVER, this._playerWindowV0_DM_ERROR_HANDLER);

				targetRows.forEach((r, i) => {
					r.name = p2pMetaV0.serverInfo[i].name;
					r.serverInfo = p2pMetaV0.serverInfo[i];
					r.$iptTokenServer.val(p2pMetaV0.serverInfo[i].textifiedSdp).attr("disabled", false);

					p2pMetaV0.serverInfo[i].rowMeta = r;

					r.$iptTokenClient.attr("disabled", false);
					r.$btnAcceptClientToken.attr("disabled", false);
				});
			})();

			await p2pMetaV0.serverInfo;
			return targetRows.map(r => r.serverInfo.textifiedSdp);
		}
	}

	handleClick_playerWindowV0 ({p2pMetaV0, doUpdateExternalStates}) {
		const {$modalInner} = UiUtil.getShowModal({
			title: "Configure Player View",
			isUncappedHeight: true,
			isHeight100: true,
			cbClose: () => {
				if (p2pMetaV0.rows.length) p2pMetaV0.rows.forEach(row => row.$row.detach());
			},
		});

		const $wrpHelp = UiUtil.$getAddModalRow($modalInner, "div");
		const $btnAltGenAll = $(`<button class="btn btn-primary btn-text-insert">Generate All</button>`).click(() => $btnGenServerTokens.click());
		const $btnAltCopyAll = $(`<button class="btn btn-primary btn-text-insert">Copy Server Tokens</button>`).click(() => $btnCopyServers.click());
		$$`<div class="ve-flex w-100">
			<div class="col-12">
				<p>
				The Player View is part of a peer-to-peer (i.e., serverless) system to allow players to connect to a DM's initiative tracker. Players should use the <a href="inittrackerplayerview.html">Initiative Tracker Player View</a> page to connect to the DM's instance. As a DM, the usage is as follows:
				<ol>
						<li>Add the required number of players, and input (preferably unique) player names.</li>
						<li>Click "${$btnAltGenAll}," which will generate a "server token" per player. You can click "${$btnAltCopyAll}" to copy them all as a single block of text, or click on the "Server Token" values to copy them individually. Distribute these tokens to your players (via a messaging service of your choice; we recommend <a href="https://discordapp.com/">Discord</a>). Each player should paste their token into the <a href="inittrackerplayerview.html">Initiative Tracker Player View</a>, following the instructions provided therein.</li>
						<li>
							Get a resulting "client token" from each player via a messaging service of your choice. Then, either:
							<ol type="a">
								<li>Click the "Accept Multiple Clients" button, and paste in text containing multiple client tokens. <b>This will try to find tokens in <i>any</i> text, ignoring everything else.</b> Pasting a chatroom log (containing, for example, usernames and timestamps mixed with tokens) is the expected usage.</li>
								<li>Paste each token into the appropriate "Client Token" field and "Accept Client" on each. A token can be identified by the slugified player name in the first few characters.</li>
							</ol>
						</li>
					</ol>
				</p>
				<p>Once a player's client has been "accepted," it will receive updates from the DM's tracker. <i>Please note that this system is highly experimental. Your experience may vary.</i></p>
			</div>
		</div>`.appendTo($wrpHelp);

		UiUtil.addModalSep($modalInner);

		const $wrpTop = UiUtil.$getAddModalRow($modalInner, "div");

		const $btnAddClient = $(`<button class="btn btn-xs btn-primary" title="Add Client">Add Player</button>`).click(() => addClientRow());

		const $btnCopyServers = $(`<button class="btn btn-xs btn-primary" title="Copy any available server tokens to the clipboard">Copy Server Tokens</button>`)
			.click(async () => {
				const targetRows = p2pMetaV0.rows.filter(it => !it.isDeleted && !it.$iptTokenClient.attr("disabled"));
				if (!targetRows.length) {
					JqueryUtil.doToast({
						content: `No free server tokens to copy. Generate some!`,
						type: "warning",
					});
				} else {
					await MiscUtil.pCopyTextToClipboard(targetRows.map(it => it.$iptTokenServer.val()).join("\n\n"));
					JqueryUtil.showCopiedEffect($btnGenServerTokens);
				}
			});

		const $btnAcceptClients = $(`<button class="btn btn-xs btn-primary" title="Open a prompt into which text containing client tokens can be pasted">Accept Multiple Clients</button>`)
			.click(() => {
				const {$modalInner, doClose} = UiUtil.getShowModal({title: "Accept Multiple Clients"});

				const $iptText = $(`<textarea class="form-control dm-init-pl__textarea block mb-2"></textarea>`)
					.keydown(() => $iptText.removeClass("error-background"));

				const $btnAccept = $(`<button class="btn btn-xs btn-primary block text-center" title="Add Client">Accept Multiple Clients</button>`)
					.click(async () => {
						$iptText.removeClass("error-background");
						const txt = $iptText.val();
						if (!txt.trim() || !PeerUtilV0.containsAnyTokens(txt)) {
							$iptText.addClass("error-background");
						} else {
							const connected = await PeerUtilV0.pConnectClientsToServers(p2pMetaV0.serverInfo, txt);
							this._board.doBindAlertOnNavigation();
							connected.forEach(serverInfo => {
								serverInfo.rowMeta.$iptTokenClient.val(serverInfo._tempTokenToDisplay || "").attr("disabled", true);
								serverInfo.rowMeta.$btnAcceptClientToken.attr("disabled", true);
								delete serverInfo._tempTokenToDisplay;
							});
							doClose();
							doUpdateExternalStates();
						}
					});

				$$`<div>
					<p>Paste text containing one or more client tokens, and click "Accept Multiple Clients"</p>
					${$iptText}
					<div class="ve-flex-vh-center">${$btnAccept}</div>
				</div>`.appendTo($modalInner);
			});

		$$`
			<div class="ve-flex w-100">
				<div class="col-12">
					<div class="ve-flex-inline-v-center mr-2">
						<span class="mr-1">Add a player (client):</span>
						${$btnAddClient}
					</div>
					<div class="ve-flex-inline-v-center mr-2">
						<span class="mr-1">Copy all un-paired server tokens:</span>
						${$btnCopyServers}
					</div>
					<div class="ve-flex-inline-v-center mr-2">
						<span class="mr-1">Mass-accept clients:</span>
						${$btnAcceptClients}
					</div>
				</div>
			</div>
		`.appendTo($wrpTop);

		UiUtil.addModalSep($modalInner);

		const $btnGenServerTokens = $(`<button class="btn btn-primary btn-xs">Generate All</button>`)
			.click(() => this._playerWindowV0_pGetServerTokens({p2pMetaV0, rowMetas: p2pMetaV0.rows}));

		UiUtil.$getAddModalRow($modalInner, "div")
			.append($$`
			<div class="ve-flex w-100">
				<div class="col-2 bold">Player Name</div>
				<div class="col-3-5 bold">Server Token</div>
				<div class="col-1 text-center">${$btnGenServerTokens}</div>
				<div class="col-3-5 bold">Client Token</div>
			</div>
		`);

		const _get$rowTemplate = (
			$iptName,
			$iptTokenServer,
			$btnGenServerToken,
			$iptTokenClient,
			$btnAcceptClientToken,
			$btnDeleteClient,
		) => $$`<div class="w-100 mb-2 ve-flex">
			<div class="col-2 pr-1">${$iptName}</div>
			<div class="col-3-5 px-1">${$iptTokenServer}</div>
			<div class="col-1 px-1 ve-flex-vh-center">${$btnGenServerToken}</div>
			<div class="col-3-5 px-1">${$iptTokenClient}</div>
			<div class="col-1-5 px-1 ve-flex-vh-center">${$btnAcceptClientToken}</div>
			<div class="col-0-5 pl-1 ve-flex-vh-center">${$btnDeleteClient}</div>
		</div>`;

		const clientRowMetas = [];
		const addClientRow = () => {
			const rowMeta = {id: CryptUtil.uid()};
			clientRowMetas.push(rowMeta);

			const $iptName = $(`<input class="form-control input-sm">`)
				.keydown(evt => {
					$iptName.removeClass("error-background");
					if (evt.key === "Enter") $btnGenServerToken.click();
				});

			const $iptTokenServer = $(`<input class="form-control input-sm copyable code" readonly disabled>`)
				.click(async () => {
					await MiscUtil.pCopyTextToClipboard($iptTokenServer.val());
					JqueryUtil.showCopiedEffect($iptTokenServer);
				}).disableSpellcheck();

			const $btnGenServerToken = $(`<button class="btn btn-xs btn-primary" title="Generate Server Token">Generate</button>`)
				.click(() => this._playerWindowV0_pGetServerTokens({p2pMetaV0, rowMetas: [rowMeta]}));

			const $iptTokenClient = $(`<input class="form-control input-sm code" disabled>`)
				.keydown(evt => {
					$iptTokenClient.removeClass("error-background");
					if (evt.key === "Enter") $btnAcceptClientToken.click();
				}).disableSpellcheck();

			const $btnAcceptClientToken = $(`<button class="btn btn-xs btn-primary" title="Accept Client Token" disabled>Accept Client</button>`)
				.click(async () => {
					const token = $iptTokenClient.val();
					if (PeerUtilV0.isValidToken(token)) {
						try {
							await PeerUtilV0.pConnectClientsToServers([rowMeta.serverInfo], token);
							this._board.doBindAlertOnNavigation();
							$iptTokenClient.prop("disabled", true);
							$btnAcceptClientToken.prop("disabled", true);
							doUpdateExternalStates();
						} catch (e) {
							JqueryUtil.doToast({
								content: `Failed to accept client token! Are you sure it was valid? (See the log for more details.)`,
								type: "danger",
							});
							setTimeout(() => { throw e; });
						}
					} else $iptTokenClient.addClass("error-background");
				});

			const $btnDeleteClient = $(`<button class="btn btn-xs btn-danger"><span class="glyphicon glyphicon-trash"></span></button>`)
				.click(() => {
					rowMeta.$row.remove();
					rowMeta.isDeleted = true;
					if (rowMeta.serverInfo) {
						rowMeta.serverInfo.server.close();
						rowMeta.serverInfo.isDeleted = true;
					}
					const ix = clientRowMetas.indexOf(rowMeta);
					if (~ix) clientRowMetas.splice(ix, 1);

					if (!clientRowMetas.length) addClientRow();
				});

			rowMeta.$row = _get$rowTemplate(
				$iptName,
				$iptTokenServer,
				$btnGenServerToken,
				$iptTokenClient,
				$btnAcceptClientToken,
				$btnDeleteClient,
			).appendTo($wrpRowsInner);

			rowMeta.$iptName = $iptName;
			rowMeta.$iptTokenServer = $iptTokenServer;
			rowMeta.$btnGenServerToken = $btnGenServerToken;
			rowMeta.$iptTokenClient = $iptTokenClient;
			rowMeta.$btnAcceptClientToken = $btnAcceptClientToken;
			p2pMetaV0.rows.push(rowMeta);

			return rowMeta;
		};

		const $wrpRows = UiUtil.$getAddModalRow($modalInner, "div");
		const $wrpRowsInner = $(`<div class="w-100"></div>`).appendTo($wrpRows);

		if (p2pMetaV0.rows.length) p2pMetaV0.rows.forEach(row => row.$row.appendTo($wrpRowsInner));
		else addClientRow();
	}

	async pHandleDoConnectLocalV0 ({p2pMetaV0, clientView}) {
		// generate a stub/fake row meta
		const rowMeta = {
			id: CryptUtil.uid(),
			$row: $(),
			$iptName: $(`<input value="local">`),
			$iptTokenServer: $(),
			$btnGenServerToken: $(),
			$iptTokenClient: $(),
			$btnAcceptClientToken: $(),
		};

		p2pMetaV0.rows.push(rowMeta);

		const serverTokens = await this._playerWindowV0_pGetServerTokens({p2pMetaV0, rowMetas: [rowMeta]});
		const clientData = await PeerUtilV0.pInitialiseClient(
			serverTokens[0],
			msg => clientView.handleMessage(msg),
			() => {}, // ignore local errors
		);
		clientView.clientData = clientData;
		await PeerUtilV0.pConnectClientsToServers([rowMeta.serverInfo], clientData.textifiedSdp);
	}
}
