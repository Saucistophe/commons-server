import {
  ResponseRule,
  ResponseRuleTargets,
  RouteResponse
} from '@mockoon/commons';
import { Request } from 'express';
import { get as objectPathGet } from 'object-path';
import { ParsedQs } from 'qs';

/**
 * Interpretor for the route response rules.
 * Extract the rules targets from the request (body, headers, etc).
 * Get the first route response for which at least one rule is fulfilled.
 */
export class ResponseRulesInterpreter {
  private targets: {
    [key in
      | Exclude<ResponseRuleTargets, 'header' | 'request_number' | 'cookie'>
      | 'bodyRaw']: any;
  };

  constructor(
    private routeResponses: RouteResponse[],
    private request: Request,
    private randomResponse: boolean,
    private sequentialResponse: boolean
  ) {
    this.extractTargets();
  }

  /**
   * Choose the route response depending on the first fulfilled rule.
   * If no rule has been fulfilled get the first route response.
   */
  public chooseResponse(requestNumber: number): RouteResponse {
    if (this.randomResponse) {
      const randomStatus = Math.floor(
        Math.random() * this.routeResponses.length
      );

      return this.routeResponses[randomStatus];
    }

    if (this.sequentialResponse) {
      return this.routeResponses[
        (requestNumber - 1) % this.routeResponses.length
      ];
    } else {
      let response = this.routeResponses.find((routeResponse) => {
        if (routeResponse.rules.length === 0) {
          return false;
        }

        return routeResponse.rulesOperator === 'AND'
          ? routeResponse.rules.every((rule) =>
              this.isValidRule(rule, requestNumber)
            )
          : routeResponse.rules.some((rule) =>
              this.isValidRule(rule, requestNumber)
            );
      });

      if (response === undefined) {
        response = this.routeResponses[0];
      }

      return response;
    }
  }

  /**
   * Check if a rule is valid by comparing the value extracted from the target to the rule value
   */
  private isValidRule = (
    rule: ResponseRule,
    requestNumber: number
  ): boolean => {
    if (!rule.target) {
      return false;
    }

    let value: any;

    if (rule.target === 'request_number') {
      value = requestNumber;
    }

    if (rule.target === 'cookie') {
      if (!rule.modifier) {
        return false;
      }
      value = this.request.cookies && this.request.cookies[rule.modifier];
    } else if (rule.target === 'header') {
      value = this.request.header(rule.modifier);
    } else {
      if (rule.modifier) {
        value = objectPathGet(this.targets[rule.target], rule.modifier);
      } else if (!rule.modifier && rule.target === 'body') {
        value = this.targets.bodyRaw;
      }
    }

    if (rule.operator === 'null' && rule.modifier) {
      return value === null || value === undefined;
    }

    if (rule.operator === 'empty_array' && rule.modifier) {
      return Array.isArray(value) && value.length < 1;
    }

    if (value === undefined) {
      return false;
    }

    // value may be explicitely null (JSON), this is considered as an empty string
    if (value === null) {
      value = '';
    }

    // rule value may be explicitely null (is shouldn't anymore), this is considered as an empty string too
    if (rule.value === null) {
      rule.value = '';
    }

    let regex: RegExp;

    if (rule.operator === 'regex') {
      regex = new RegExp(rule.value);

      return Array.isArray(value)
        ? value.some((arrayValue) => regex.test(arrayValue))
        : regex.test(value);
    }

    if (Array.isArray(value)) {
      return value.includes(rule.value);
    }

    return String(value) === String(rule.value);
  };

  /**
   * Extract rules targets from the request (body, headers, etc)
   */
  private extractTargets() {
    const requestContentType = this.request.header('Content-Type');
    let body: ParsedQs | JSON = {};

    if (requestContentType) {
      if (
        requestContentType.includes('application/x-www-form-urlencoded') ||
        requestContentType.includes('application/json') ||
        requestContentType.includes('application/xml') ||
        requestContentType.includes('text/xml')
      ) {
        body = this.request.parsedBody;
      }
    }

    this.targets = {
      body,
      query: this.request.query,
      params: this.request.params,
      bodyRaw: this.request.body.toString()
    };
  }
}
