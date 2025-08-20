import GlobalStore from './src/main/ets/model/GlobalStore';
const init = GlobalStore.init
const GetIBestORM = () => {
  return GlobalStore.orm
}
export { init as IBestORMInit, GetIBestORM }
export { Table } from './src/main/ets/decorator/Table';
export { Field } from './src/main/ets/decorator/Field';
export * from './src/main/ets/model/Global.type';
export * from './src/main/ets/model/Mode';
