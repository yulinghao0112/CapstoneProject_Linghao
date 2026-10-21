import React, { useEffect } from 'react';
import Routes from './routes';

//Import Scss
import "./assets/scss/themes.scss";

//fackbackend
import fakeBackend from './helpers/fake-backend';
import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';

// 项目状态初始化组件
import ProjectInitializer from './components/ProjectInitializer';

fakeBackend();

function App() {

  const selectLayoutProperties = createSelector(
    (state) => state.Layout,
    (layout) => ({
      layoutMode: layout.layoutMode,
    })
  );
  
  const { layoutMode } = useSelector(selectLayoutProperties);

useEffect(() => {
  layoutMode && localStorage.setItem("layoutMode",layoutMode);
}, [layoutMode])

  return (
    <>
      <ProjectInitializer />
      <Routes />
    </>
  );
};

export default App;
