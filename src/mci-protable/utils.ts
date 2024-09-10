import { apply } from 'json-logic-js';
import { merge } from 'lodash';
import { z } from 'zod';
import { ILogicItem, MciProColumns } from './types';

/**
 * 从试验结果来看，`data` 这个 key 必须有。`totalCount` 或者 `count` 字段没有也不会报错。
 * 但是如果要向用户提供分页请求的功能的话，必要要有者两个字段(`totalCount` 或者 `count`)中的其中之一。
 */
export function isBackendDataValid(res: any) {
  const res1Schema = z.object({
    data: z.array(z.record(z.any())),
    total: z.number(),
  });

  const res2Schema = z.object({
    data: z.array(z.record(z.any())),
    totalCount: z.number(),
  });

  const resSchema = z.union([res1Schema, res2Schema]);

  try {
    resSchema.parse(res);
  } catch (error) {
    console.error(error);
    return false;
  }

  return true;
}

/**
 * 转换逻辑配置, 将逻辑配置转换为formItemProps fieldProps columns依赖配置
 *
 * form json 配置参考: https://procomponents.ant.design/components/schema-form#betaschemaform-demo-dynamic-rerender
 *
 * logics 配置参考: https://jsonlogic.com/operations.html
 *
 * @param cols columns配置
 * @returns columns配置
 * @example
 * ```tsx
 * // jsonLogic 模式
 * const columns = [
 *  {
 *   title: '姓名',
 *   dataIndex: 'name',
 *   valueType: 'text',
 *   logics: [{
 *     dependencies: ['age'],
 *     logicFor: 'formItemProps',
 *     logic: {
 *       '==': [{ var: 'age' }, 18]
 *     },
 *     truth: {
 *       required: true
 *     },
 *     falsehood: {
 *       required: false
 *     }
 *   }
 * ];
 *
 * // 字符串函数模式
 * const columns = [
 *  {
 *   title: '姓名',
 *   dataIndex: 'name',
 *   valueType: 'text',
 *   logics: [{
 *     functionString: 'function (form) { return form.getFieldsValue().age === 18 ? { required: true } : { required: false } }',
 *     dependencies: ['age'],
 *     logicFor: 'formItemProps'
 *   }]
 *  }
 * ];
 *
 * // 渲染后可以理解成以下等效pro-components scheme配置
 *
 * const columns = [
 *  {
 *   title: '姓名',
 *   dataIndex: 'name',
 *   valueType: 'text',
 *   formItemProps: (form) => {
 *     if (form.getFieldsValue().age === 18) {
 *       return { required: true };
 *     }
 *     return { required: false };
 *   }
 *  }
 * ];
 *
 * ```
 */
export const patchDependenciesJsonLogic = (cols: MciProColumns[], formType: ILogicItem['formTypes'][number]) => {
  const tempCols: MciProColumns[] = merge([], cols);
  tempCols.forEach((col) => {
    col.logics?.forEach((logicItem) => {
      const {
        functionString,
        logicFor,
        logic,
        truthy,
        falsy,
        dependencies = [],
        formTypes = ['createForm', 'editForm'],
      } = logicItem;

      if (!formTypes?.includes(formType)) return;

      if (!dependencies?.length || !logicFor) return;

      // 字符串函数模式
      const isFunctionString = !!functionString;

      const updateOfEvalFunction = (...args: any[]) => {
        try {
          // eslint-disable-next-line no-eval
          return eval(`(${functionString})`)(...args);
        } catch (error) {
          console.error('logicFunction error:', error);
          return {};
        }
      };

      if ((logicFor as string) === 'columns') {
        const columnsUpdate = (data: any) => {
          if (apply(logic, data)) {
            return truthy || [];
          }
          return falsy || [];
        };
        Object.assign(col, {
          valueType: 'dependency',
          name: dependencies,
          columns: isFunctionString ? updateOfEvalFunction : columnsUpdate,
        });
      } else {
        const propsUpdate = (form: any) => {
          if (apply(logic, form.getFieldsValue())) {
            return truthy || {};
          }
          return falsy || {};
        };
        Object.assign(col, {
          dependencies,
          // formItemProps fieldProps
          [logicFor]: isFunctionString ? updateOfEvalFunction : propsUpdate,
        });
      }
    });

    delete col.logics;
  });
  return tempCols;
};

/** 否为特殊操作列 */
export const isActionColumn = (column: any) => column.title === '操作' || column.dataIndex === '__action__';

export function checkBeforeRequest(apiMap: Record<string, (...params: any[]) => void>, serviceName: string) {
  if (typeof serviceName !== 'string') {
    throw new Error('serviceName must be string');
  }

  if (typeof apiMap[serviceName] !== 'function') {
    throw new Error(`Can not find service('${serviceName}') in apiMap, please check`);
  }

  return true;
}

/**
 * 转换schema中的JSFunction为真正的函数
 */
export const transformSchema = (props: any) => {
  const res = { ...props };
  const traverser = (obj: any) => {
    for (const key in obj) {
      const isArray = Array.isArray(obj[key]);
      if (isArray) {
        obj[key].forEach((item: any) => {
          traverser(item);
        });
        continue;
      }

      const isObject = typeof obj[key] === 'object';
      if (!isObject) continue;

      if (obj[key] && obj[key].type === 'JSFunction' && typeof obj[key].value === 'string') {
        obj[key] = eval(`(${obj[key].value})`);
        continue;
      }

      traverser(obj[key]);
    }
  };
  traverser(res);
  return res;
};

export function extractHttpMethodFromServiceName(serviceName: string) {
  if (!serviceName) {
    return null;
  }
  const pattern = /^(post|get|put|delete|patch|head)\w*/i;
  const match = serviceName.match(pattern);
  return match ? match[1].toLowerCase() : null;
}
