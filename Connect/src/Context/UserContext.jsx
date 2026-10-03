import { createContext, useState, useEffect } from "react";
import {jwtDecode} from 'jwt-decode'

export const UserContext = createContext()

export function UserProvider({ children }) {
    const [user, setUser] = useState(null)

    useEffect(() => {
7
        async function fetchData() {
            const token = localStorage.getItem("Token");
            console.log(token)

            if (token) {
                try {
                    const decodedData = jwtDecode(token);
                    setUser(decodedData);
                } catch (error) {
                    console.error("Token is invalid or expired");
                    localStorage.removeItem("token");
                }
            }
        }

        fetchData()

    }, []);

    const updatedUserState = (updatedData) => {
        setUser((prevUser) => ({ ...prevUser, ...updatedData }));
    }

    return (
        <UserContext.Provider value={{ user, setUser, updatedUserState }}>
            {children}
        </UserContext.Provider>
    )
}