/*
Redux actions for nbviewer.
*/

import { fromJS } from "immutable";
import { Actions } from "../../app-framework";
import { cm_options } from "../cm_options";
import { sorted_cell_list } from "../cell-utils";
import { JUPYTER_MIMETYPES } from "../util";
import { IPynbImporter } from "../import-from-ipynb";

import { NBViewerState, NBViewerStore } from "./store";

export class NBViewerActions extends Actions<NBViewerState> {
  private store: NBViewerStore;
  private client: any;
  private _state: "ready" | "closed";

  public _init = (
    project_id: string,
    path: string,
    store: NBViewerStore,
    client: any,
    content: string | undefined
  ): void => {
    this.store = store;
    if (client == null && content == null) {
      throw Error("@client or content must be defined");
    }
    this.client = client;
    this.setState({
      project_id,
      path,
      font_size:
        this.redux.getStore("account") &&
        this.redux.getStore("account").get("font_size", 14)
    });
    this._state = "ready";
    if (content == null) {
      this.load_ipynb();
      return;
    }
    // optionally specify the pre-loaded content of the path directly.
    try {
      this.set_from_ipynb(JSON.parse(content));
    } catch (err) {
      this.setState({ error: `Error parsing -- ${err}` });
    }
  };

  private load_ipynb = (): void => {
    if (this.store.get("loading")) {
      return;
    }
    this.setState({ loading: new Date() });
    // TODO: is this return required?
    this.client.public_get_text_file({
      project_id: this.store.get("project_id"),
      path: this.store.get("path"),
      // TODO: rewrite with async
      cb: (err: any, data: any) => {
        if (this._state === "closed") {
          return;
        }
        this.setState({ loading: undefined });
        if (err) {
          this.setState({ error: `Error loading -- ${err}` });
          return;
        }
        try {
          return this.set_from_ipynb(JSON.parse(data));
        } catch (error) {
          this.setState({ error: `Error parsing -- ${error}` });
        }
      }
    });
  };

  private _process = (content: any): void => {
    if (content.data == null) {
      return;
    }
    for (const type of JUPYTER_MIMETYPES) {
      if (
        content.data[type] != null &&
        (type.split("/")[0] === "image" || type === "application/pdf")
      ) {
        content.data[type] = { value: content.data[type] };
      }
    }
  };

  set_from_ipynb = (ipynb: any) => {
    const importer = new IPynbImporter();
    importer.import({
      ipynb,
      output_handler: (cell: any) => {
        let k = 0;
        return {
          message: content => {
            this._process(content);
            cell.output[`${k}`] = content;
            return (k += 1);
          }
        };
      }
    });

    const cells = fromJS(importer.cells());
    const cell_list = sorted_cell_list(cells);

    let mode: string | undefined = undefined;
    if (
      ipynb.metadata &&
      ipynb.metadata.language_info &&
      ipynb.metadata.language_info.codemirror_mode
    ) {
      mode = ipynb.metadata.language_info.codemirror_mode;
    } else if (
      ipynb.metadata &&
      ipynb.metadata.language_info &&
      ipynb.metadata.language_info.name
    ) {
      mode = ipynb.metadata.language_info.name;
    } else if (
      ipynb.metadata &&
      ipynb.metadata.kernelspec &&
      ipynb.metadata.kernelspec.language
    ) {
      mode = ipynb.metadata.kernelspec.language.toLowerCase();
    }
    const options = fromJS({
      markdown: undefined,
      options: cm_options(mode)
    });
    return this.setState({
      cells,
      cell_list,
      cm_options: options
    });
  };
  close = () => {
    delete this.store;
    delete this.client;
    return (this._state = "closed");
  };
}
