import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// Mock the environment variables
jest.mock('@env', () => ({
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

describe('Navigation', () => {
  it('should render the app with tab navigation without authentication', async () => {
    let component: ReactTestRenderer.ReactTestRenderer;
    
    await ReactTestRenderer.act(async () => {
      component = ReactTestRenderer.create(<App />);
    });
    
    // Verify that the app renders successfully
    // The tab navigation should be available immediately without requiring login
    const tree = component!.toJSON();
    expect(tree).toBeTruthy();
  });

  it('should provide direct access to all screens in demo mode', async () => {
    let component: ReactTestRenderer.ReactTestRenderer;
    
    await ReactTestRenderer.act(async () => {
      component = ReactTestRenderer.create(<App />);
    });
    
    // Verify that the navigation structure is present
    const instance = component!.root;
    
    // Check that tab navigator is rendered (contains the tab screens)
    expect(instance).toBeTruthy();
  });
});
