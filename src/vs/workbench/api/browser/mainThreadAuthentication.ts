/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import * as modes from 'vs/editor/common/modes';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { IAuthenticationService } from 'vs/workbench/services/authentication/browser/authenticationService';
import { ExtHostAuthenticationShape, ExtHostContext, IExtHostContext, MainContext, MainThreadAuthenticationShape } from '../common/extHost.protocol';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import Severity from 'vs/base/common/severity';

export class MainThreadAuthenticationProvider {
	constructor(
		private readonly _proxy: ExtHostAuthenticationShape,
		public readonly id: string
	) { }

	getSessions(): Promise<ReadonlyArray<modes.Session>> {
		return this._proxy.$getSessions(this.id);
	}

	login(): Promise<modes.Session> {
		return this._proxy.$login(this.id);
	}

	logout(accountId: string): Promise<void> {
		return this._proxy.$logout(this.id, accountId);
	}
}

@extHostNamedCustomer(MainContext.MainThreadAuthentication)
export class MainThreadAuthentication extends Disposable implements MainThreadAuthenticationShape {
	private readonly _proxy: ExtHostAuthenticationShape;

	constructor(
		extHostContext: IExtHostContext,
		@IAuthenticationService private readonly authenticationService: IAuthenticationService,
		@IDialogService private readonly dialogService: IDialogService,
		@IStorageService private readonly storageService: IStorageService
	) {
		super();
		this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostAuthentication);
	}

	$registerAuthenticationProvider(id: string): void {
		const provider = new MainThreadAuthenticationProvider(this._proxy, id);
		this.authenticationService.registerAuthenticationProvider(id, provider);
	}

	$unregisterAuthenticationProvider(id: string): void {
		this.authenticationService.unregisterAuthenticationProvider(id);
	}

	$onDidChangeSessions(id: string): void {
		this.authenticationService.sessionsUpdate(id);
	}

	async $getSessionsPrompt(providerId: string, providerName: string, extensionId: string, extensionName: string): Promise<boolean> {
		const alwaysAllow = this.storageService.get(`${extensionId}-${providerId}`, StorageScope.GLOBAL);
		if (alwaysAllow) {
			return true;
		}

		const { choice } = await this.dialogService.show(
			Severity.Info,
			`The extension '${extensionName}' is trying to access authentication information from ${providerName}.`,
			['Cancel', 'Allow', 'Always Allow',],
			{ cancelId: 0 }
		);

		switch (choice) {
			case 1/** Allow */:
				return true;
			case 2 /** Always Allow */:
				this.storageService.store(`${extensionId}-${providerId}`, 'true', StorageScope.GLOBAL);
				return true;
			default:
				return false;
		}
	}

	async $loginPrompt(providerId: string, providerName: string, extensionId: string, extensionName: string): Promise<boolean> {
		const alwaysAllow = this.storageService.get(`${extensionId}-${providerId}`, StorageScope.GLOBAL);
		if (alwaysAllow) {
			return true;
		}

		const { choice } = await this.dialogService.show(
			Severity.Info,
			`The extension '${extensionId}' wants to sign in using ${providerName}.`,
			['Allow', 'Always Allow', 'Cancel'],
			{ cancelId: 2 }
		);

		switch (choice) {
			case 1/** Allow */:
				return true;
			case 2 /** Always Allow */:
				this.storageService.store(`${extensionId}-${providerId}`, 'true', StorageScope.GLOBAL);
				return true;
			default:
				return false;
		}
	}
}
