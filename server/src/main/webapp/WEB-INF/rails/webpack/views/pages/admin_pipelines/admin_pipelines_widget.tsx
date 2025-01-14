/*
 * Copyright 2019 ThoughtWorks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {MithrilViewComponent} from "jsx/mithril-component";
import _ from "lodash";
import m from "mithril";
import Stream from "mithril/stream";
import {PipelineGroup, PipelineGroups, PipelineWithOrigin} from "models/internal_pipeline_structure/pipeline_structure";
import s from "underscore.string";
import {ButtonIcon, Primary} from "views/components/buttons";
import {FlashMessage, MessageType} from "views/components/flash_message";
import {ChevronRightCircle, Clone, Delete, Download, Edit, IconGroup, Plus} from "views/components/icons";
import {SaveOperation} from "views/pages/page_operations";
import styles from "./admin_pipelines_widget.scss";

interface Operations extends SaveOperation {
  doClonePipeline: (pipeline: PipelineWithOrigin) => void;
  doMovePipeline: (sourceGroup: PipelineGroup, pipeline: PipelineWithOrigin) => void;
  doEditPipeline: (pipeline: PipelineWithOrigin) => void;
  doDownloadPipeline: (pipeline: PipelineWithOrigin) => void;
  doDeletePipeline: (pipeline: PipelineWithOrigin) => void;
  doExtractPipeline: (pipeline: PipelineWithOrigin) => void;
  doEditPipelineGroup: (group: PipelineGroup) => void;
  doDeleteGroup: (group: PipelineGroup) => void;
  createPipelineInGroup: (groupName: string) => void;
}

interface PipelineGroupAttrs extends Operations {
  group: PipelineGroup;
}

export interface Attrs extends Operations {
  pipelineGroups: Stream<PipelineGroups>;
  createPipelineGroup: () => void;
}

type PipelineWidgetAttrs = PipelineGroupAttrs & { pipeline: PipelineWithOrigin };

class PipelineWidget extends MithrilViewComponent<PipelineWidgetAttrs> {
  view(vnode: m.Vnode<PipelineWidgetAttrs, this>) {
    return (
      <div data-test-id={`pipeline-${s.slugify(vnode.attrs.pipeline.name())}`} class={styles.pipelineRow}>
        <div data-test-id={`pipeline-name-${s.slugify(vnode.attrs.pipeline.name())}`}
             class={styles.pipelineName}>{vnode.attrs.pipeline.name()}</div>
        <div class={styles.pipelineActionButtons}>{this.actions(vnode, vnode.attrs.pipeline)}</div>
      </div>
    );
  }

  private static messageForOperation(pipeline: PipelineWithOrigin,
                                     operation: "move" | "clone" | "edit" | "delete" | "extract template from") {
    if (operation === "extract template from" && pipeline.usesTemplate()) {
      return `Cannot ${operation} pipeline '${pipeline.name()}' because it uses a template.`;
    }

    if (pipeline.origin().isDefinedInConfigRepo()) {
      return `Cannot ${operation} pipeline '${pipeline.name()}' because it is defined in a configuration repository '${pipeline.origin()
                                                                                                                               .id()}'.`;
    } else {
      return `${s.capitalize(operation)} pipeline '${pipeline.name()}'`;
    }
  }

  private actions(vnode: m.Vnode<PipelineWidgetAttrs, this>, eachPipeline: PipelineWithOrigin) {
    return (
      <IconGroup>
        <Edit
          disabled={eachPipeline.origin().isDefinedInConfigRepo()}
          data-test-id={`edit-pipeline-${s.slugify(eachPipeline.name())}`}
          title={PipelineWidget.messageForOperation(eachPipeline, "edit")}
          onclick={vnode.attrs.doEditPipeline.bind(vnode.attrs, eachPipeline)}/>
        <ChevronRightCircle
          disabled={eachPipeline.origin().isDefinedInConfigRepo()}
          data-test-id={`move-pipeline-${s.slugify(eachPipeline.name())}`}
          title={PipelineWidget.messageForOperation(eachPipeline, "move")}
          onclick={vnode.attrs.doMovePipeline.bind(vnode.attrs, vnode.attrs.group, eachPipeline)}/>
        <Download
          data-test-id={`download-pipeline-${s.slugify(eachPipeline.name())}`}
          title={`Download pipeline configuration for '${eachPipeline.name()}'`}
          onclick={vnode.attrs.doDownloadPipeline.bind(vnode.attrs, eachPipeline)}/>
        <Clone
          disabled={eachPipeline.origin().isDefinedInConfigRepo()}
          data-test-id={`clone-pipeline-${s.slugify(eachPipeline.name())}`}
          title={PipelineWidget.messageForOperation(eachPipeline, "clone")}
          onclick={vnode.attrs.doClonePipeline.bind(vnode.attrs, eachPipeline)}/>
        <Delete
          disabled={eachPipeline.origin().isDefinedInConfigRepo()}
          data-test-id={`delete-pipeline-${eachPipeline.name()}`}
          title={PipelineWidget.messageForOperation(eachPipeline, "delete")}
          onclick={vnode.attrs.doDeletePipeline.bind(vnode.attrs, eachPipeline)}/>
        <Plus
          disabled={eachPipeline.origin().isDefinedInConfigRepo() || eachPipeline.usesTemplate()}
          data-test-id={`extract-template-from-pipeline-${eachPipeline.name()}`}
          title={PipelineWidget.messageForOperation(eachPipeline, "extract template from")}
          onclick={vnode.attrs.doExtractPipeline.bind(vnode.attrs, eachPipeline)}/>
      </IconGroup>
    );
  }
}

class PipelineGroupWidget extends MithrilViewComponent<PipelineGroupAttrs> {
  oncreate(vnode: m.VnodeDOM<PipelineGroupAttrs, this>) {
    const param            = m.route.param();
    const selectedFragment = param ? param.id : undefined;

    if (selectedFragment && selectedFragment.toLowerCase() === vnode.attrs.group.name().toLowerCase()) {
      vnode.dom.scrollIntoView(true);
      // width of the fixed elements at top + some buffer
      window.scrollBy(0, -120);
    }
  }

  view(vnode: m.Vnode<PipelineGroupAttrs, this>) {
    return (
      <div data-test-id={`pipeline-group-${s.slugify(vnode.attrs.group.name())}`}
           class={styles.pipelineGroupRow}>
        <div data-test-id={`pipeline-group-name-${s.slugify(vnode.attrs.group.name())}`}
             class={styles.pipelineGroupName}>Group: {vnode.attrs.group.name()}</div>
        <div class={styles.pipelineGroupActionButtons}>{this.actions(vnode)}</div>
        {this.showPipelines(vnode)}
      </div>
    );
  }

  private showPipelines(vnode: m.Vnode<PipelineGroupAttrs, this>) {
    if (vnode.attrs.group.hasPipelines()) {
      return vnode.attrs.group.pipelines().map((eachPipeline) => {
        return <PipelineWidget pipeline={eachPipeline} {...vnode.attrs}/>;
      });
    } else {
      return (
        <div class={styles.noPipelinesDefinedMessage}>
          <FlashMessage message="There are no pipelines defined in this pipeline group." type={MessageType.info}/>
        </div>
      );
    }
  }

  private actions(vnode: m.Vnode<PipelineGroupAttrs, this>) {
    return (
      <div>
        <Primary icon={ButtonIcon.ADD}
                 dataTestId={`create-pipeline-in-group-${s.slugify(vnode.attrs.group.name())}`}
                 onclick={vnode.attrs.createPipelineInGroup.bind(vnode.attrs, vnode.attrs.group.name())}>
          Add new pipeline
        </Primary>
        <span class={styles.iconGroupWrapper}>
          <IconGroup>
            <Edit
              data-test-id={`edit-pipeline-group-${s.slugify(vnode.attrs.group.name())}`}
              onclick={vnode.attrs.doEditPipelineGroup.bind(vnode.attrs, vnode.attrs.group)}/>
            <Delete disabled={vnode.attrs.group.hasPipelines()}
                    data-test-id={`delete-pipeline-group-${s.slugify(vnode.attrs.group.name())}`}
                    title="Move or delete all pipelines within this group in order to delete it."
                    onclick={vnode.attrs.doDeleteGroup.bind(vnode.attrs, vnode.attrs.group)}/>
          </IconGroup>
        </span>
      </div>
    );
  }
}

export class PipelineGroupsWidget extends MithrilViewComponent<Attrs> {
  view(vnode: m.Vnode<Attrs>) {
    if (_.isEmpty(vnode.attrs.pipelineGroups())) {
      return <FlashMessage type={MessageType.info} message={"There are no pipelines defined."}/>;
    }
    return (
      <div data-test-id="pipeline-groups">
        {vnode.attrs.pipelineGroups().map((group) => {
          return <PipelineGroupWidget group={group} {...vnode.attrs} />;
        })}
      </div>
    );
  }
}
