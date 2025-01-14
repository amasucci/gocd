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

package com.thoughtworks.go.apiv1.internalenvironments;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.thoughtworks.go.api.ApiController;
import com.thoughtworks.go.api.ApiVersion;
import com.thoughtworks.go.api.base.JsonOutputWriter;
import com.thoughtworks.go.api.representers.JsonReader;
import com.thoughtworks.go.api.spring.ApiAuthenticationHelper;
import com.thoughtworks.go.api.util.GsonTransformer;
import com.thoughtworks.go.api.util.MessageJson;
import com.thoughtworks.go.apiv1.internalenvironments.representers.MergedEnvironmentsRepresenter;
import com.thoughtworks.go.config.EnvironmentConfig;
import com.thoughtworks.go.config.policy.SupportedAction;
import com.thoughtworks.go.config.policy.SupportedEntity;
import com.thoughtworks.go.server.service.AgentService;
import com.thoughtworks.go.server.service.EnvironmentConfigService;
import com.thoughtworks.go.spark.Routes;
import com.thoughtworks.go.spark.spring.SparkSpringController;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import spark.Request;
import spark.Response;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;

import static java.lang.String.format;
import static spark.Spark.*;

@Component
public class InternalEnvironmentsControllerV1 extends ApiController implements SparkSpringController {

    private final ApiAuthenticationHelper apiAuthenticationHelper;
    private final EnvironmentConfigService environmentConfigService;
    private final AgentService agentService;

    @Autowired
    public InternalEnvironmentsControllerV1(ApiAuthenticationHelper apiAuthenticationHelper, EnvironmentConfigService environmentConfigService, AgentService agentService) {
        super(ApiVersion.v1);
        this.apiAuthenticationHelper = apiAuthenticationHelper;
        this.environmentConfigService = environmentConfigService;
        this.agentService = agentService;
    }

    @Override
    public String controllerBasePath() {
        return Routes.InternalEnvironments.BASE;
    }

    @Override
    public void setupRoutes() {
        path(controllerBasePath(), () -> {
            before("", mimeType, this::setContentType);
            before("/*", mimeType, this::setContentType);

            before("", mimeType, this.apiAuthenticationHelper::checkAdminUserAnd403);

            before("/*", mimeType, (request, response) -> {
                if (request.requestMethod().equalsIgnoreCase("GET")) {
                    apiAuthenticationHelper.checkUserAnd403(request, response);
                } else {
                    apiAuthenticationHelper.checkAdminUserAnd403(request, response);
                }
            });

            get("", mimeType, this::index);
            get("/merged", mimeType, this::indexMergedEnvironments);
            put(Routes.InternalEnvironments.ENV_NAME, mimeType, this::updateAgentAssociation);
        });
    }

    public String index(Request request, Response response) throws IOException {
        return JsonOutputWriter.OBJECT_MAPPER.writeValueAsString(environmentConfigService.getEnvironmentNames());
    }

    public String indexMergedEnvironments(Request request, Response response) throws IOException {
        List<EnvironmentConfig> userSpecificEnvironments = new ArrayList<>();
        for (EnvironmentConfig env : environmentConfigService.getAllMergedEnvironments()) {
            if (apiAuthenticationHelper.doesUserHasPermissions(currentUsername(), getAction(request), SupportedEntity.ENVIRONMENT, env.name().toString())) {
                userSpecificEnvironments.add(env);
            }
        }

        Function<String, Boolean> canUserAdministerEnvironment = envName -> apiAuthenticationHelper.doesUserHasPermissions(currentUsername(), SupportedAction.ADMINISTER, SupportedEntity.ENVIRONMENT, envName);
        return writerForTopLevelObject(request, response, outputWriter -> MergedEnvironmentsRepresenter.toJSON(outputWriter, userSpecificEnvironments, canUserAdministerEnvironment));
    }

    String updateAgentAssociation(Request request, Response response) {
        String envName = request.params("env_name");
        EnvironmentConfig envConfig = environmentConfigService.getEnvironmentConfig(envName);
        List<String> uuids = getAgentUuids(request);
        agentService.updateAgentsAssociationOfEnvironment(envConfig, uuids);
        return renderMessage(response, 200, "Environment '" + envName + "' updated successfully!");
    }

    private List<String> getAgentUuids(Request request) {
        JsonReader jsonReader = GsonTransformer.getInstance().jsonReaderFrom(request.body());
        Optional<List<String>> uuids = jsonReader.readStringArrayIfPresent("uuids");
        if (uuids.isPresent()) {
            return uuids.get();
        }
        throw halt(422, MessageJson.create(format("Json `%s` does not contain property '%s'.", new Gson().fromJson(request.body(), JsonElement.class), "uuids")));
    }
}
