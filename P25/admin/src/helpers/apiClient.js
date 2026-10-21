import axios from 'axios';
import config from "./../config";


// default
axios.defaults.baseURL = config.API_URL;

// content type
axios.defaults.headers.post['Content-Type'] = 'application/json';

// intercepting to capture errors
axios.interceptors.response.use(function (response) {
    return response.data ? response.data : response;
}, function (error) {
    console.error('🔧 Axios interceptor caught error:', error);
    console.error('🔧 Error response:', error.response);
    console.error('🔧 Error request:', error.request);
    console.error('🔧 Error message:', error.message);
    
    // 保留原始错误对象，而不是只返回字符串消息
    // 这样TaskAnalysisModal可以访问error.response等属性
    return Promise.reject(error);
});

/**
 * Sets the default authorization
 * @param {*} token 
 */
const setAuthorization = (token) => {
    axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
}


class APIClient {
    /**
     * Fetches data from given url
     */
    get = (url, params) => {
        return axios.get(url, params);
    }

    /**
     * post given data to url
     */
    create = (url, data) => {
        return axios.post(url, data);
    }

    /**
     * Updates data
     */
    update = (url, data) => {
        return axios.patch(url, data);
    }

    /**
     * Delete 
     */
    delete = (url) => {
        return axios.put(url);
    }
}

export { APIClient, setAuthorization };