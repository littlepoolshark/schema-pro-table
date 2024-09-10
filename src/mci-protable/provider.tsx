import { createContext, createElement } from 'react';
import { PluginType, IProviderCtxProps } from './types';

function MciProtableProvider() {}

const ctx = {} as IProviderCtxProps;

MciProtableProvider.registerPlugin = <T extends PluginType>(type: T, map: IProviderCtxProps[T]) => {
  if (ctx[type]) {
    ctx[type] = {
      ...ctx[type],
      ...map,
    };
  } else {
    ctx[type] = map;
  }
};
MciProtableProvider.create = () => {
  const _ctx = createContext(ctx);

  return (props: { children: React.ReactNode }) => {
    return createElement(
      _ctx.Provider,
      {
        value: ctx,
      },
      props.children,
    );
  };
};

MciProtableProvider.registerPlugin('rowSelectionActionMap', {
  test: (props) => {
    return '';
  },
});

const Provider = MciProtableProvider.create();

const Test = () => <Provider>ASFAD</Provider>;
