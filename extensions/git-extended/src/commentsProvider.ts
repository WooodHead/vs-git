/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as _ from 'lodash';
import { Comment } from './common/models/comment';

export interface ICommentsProvider {
	provideComments(uri: vscode.Uri): Promise<Comment[]>;
}

export class CommentsProvider implements vscode.CommentProvider {
	private providers: Map<number, ICommentsProvider>;
	private _id: number;
	constructor() {
		// vscode.workspace.registerTextDocumentContentProvider('review', this);
		this.providers = new Map<number, ICommentsProvider>();
		this._id = 0;
		vscode.workspace.registerCommentProvider(this);
	}

	registerCommentProvider(provider: ICommentsProvider): number {
		this.providers.set(this._id, provider);
		this._id++;
		return this._id - 1;
	}

	unregisterCommentProvider(id: number) {
		this.providers.delete(id);
	}

	async provideComments(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CommentThread[]> {
		let promises = [];
		this.providers.forEach((value: ICommentsProvider) => {
			promises.push(value.provideComments(document.uri));
		});

		let matchingComments: Comment[] = [];
		let allComments = await Promise.all(promises);
		allComments.forEach(comments => {
			if (comments) {
				matchingComments.push(...comments);
			}
		});

		if (!matchingComments || !matchingComments.length) {
			return [];
		}

		let sections = _.groupBy(matchingComments, comment => comment.position);
		let ret = [];

		for (let i in sections) {
			let comments = sections[i];

			const comment = comments[0];
			const pos = new vscode.Position(comment.diff_hunk_range.start + comment.position - 1 - 1, 0);
			const range = new vscode.Range(pos, pos);

			ret.push({
				range,
				comments: comments.map(comment => {
					return {
						body: new vscode.MarkdownString(comment.body),
						userName: comment.user.login,
						gravatar: comment.user.avatar_url
					};
				})
			});
		}

		return ret;
	}

	// async provideComments(uri: vscode.Uri, token?: vscode.CancellationToken): Promise<Comment[]> {
	//     let promises = [];
	//     this.providers.forEach((value: ICommentsProvider) => {
	//         promises.push(value.provideComments(uri));
	//     });

	//     let ret: Comment[] = [];
	//     (await Promise.all(promises)).forEach(comments => {
	//         ret.push(...comments);
	//     });

	//     return ret;
	// }
}
