import { db } from "../db.js";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import { bufferToDataURI } from "../utlis.js";

export const getUsers = (req, res) => {
    const q = "SELECT id, username, name, email, userImg, location FROM myfeed.users;";

    db.query(q, (err, data) => {
        if (err) return res.status(500).json(data);

        return res.status(200).json(data);
    });
};

export const getUser = (req, res) => {
    const { username } = req.params;
    const q = "SELECT * FROM users JOIN followers ON followers.followedUsername = users.username WHERE users.username=?;";

    db.query(q, [username], (err, data) => {
        if (err) return res.status(500).json(err);

        const q = "SELECT id, username, name, bio, userImg, profileImg, location, x_url, instagram_url, youtube_url FROM users WHERE users.username=?;";


        db.query(q, [username], (err, data) => {
            if (err) return res.status(500).json(err);

            return res.status(200).json(data);
        });
    });
};

export const searchUsers = (req, res) => {
    let q = "SELECT * FROM users;";

    db.query(q, (err, data) => {
        if (err) return res.status(500).json(data);

        return res.status(200).json(res.status(200).json(data));
    });
};

export const updateUser = (req, res) => {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json({ message: "You are not singin!" });

    jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, userInfo) => {
        if (err) return res.status(403).json({ message: "Token is not valid!" });

        const { instagram, username, bio, name, location, x, youtube } = req.body;
        const avatar = req.files['avatar'] && req.files['avatar'][0];
        const profile = req.files['profile'] && req.files['profile'][0]

        if (avatar !== undefined || profile !== undefined) {
            if (avatar === undefined && profile !== undefined) {
                const fileProfileFormat = profile.mimetype.split('/')[1];
                const uniqueFilenameProfile = `${uuidv4()}`;
                const { base64: base64Profile } = bufferToDataURI(fileProfileFormat, profile.buffer);

                // Upload the image to Cloudinary
                const cloudinaryResponse = await cloudinary.uploader.upload(`data:image/${fileProfileFormat};base64,${base64Profile}`, {
                    public_id: uniqueFilenameProfile,
                });

                const q = `UPDATE users SET profileImg=?, name=?, username=?, bio=?, location=? , x_url=?, instagram_url=?, youtube_url=? WHERE id=?;
                           SELECT * FROM users WHERE id=?;`;

                const values = [cloudinaryResponse.secure_url, name, username, bio, location, x, instagram, youtube, userInfo.id, userInfo.id]

                db.query(q, values, (err, data) => {
                    if (err) return res.status(500).json(err);
                    return res.status(200).json({
                        id: userInfo.id,
                        instagram_url: instagram,
                        username: username,
                        name: name,
                        bio: bio,
                        location: location,
                        x_url: x,
                        profileImg: cloudinaryResponse.secure_url,
                        userImg: data[1][0].userImg,
                        youtube_url: youtube,
                        message: "Profile has been updated!"
                    });
                });
            };

            if (avatar !== undefined && profile === undefined) {
                const fileAvatarFormat = avatar.mimetype.split('/')[1];
                const uniqueFilenameAvatar = `${uuidv4()}`;
                const { base64: base64Avatar } = bufferToDataURI(fileAvatarFormat, avatar.buffer);

                // Upload the image to Cloudinary
                const cloudinaryResponse = await cloudinary.uploader.upload(`data:image/${fileAvatarFormat};base64,${base64Avatar}`, {
                    public_id: uniqueFilenameAvatar,
                    folder: 'avatars'
                });

                const q = `UPDATE users SET userImg=?, name=?, username=?, bio=?, location=? , x_url=?, instagram_url=?, youtube_url=? WHERE id=?;
                           SELECT * FROM users WHERE id=?;`

                const values = [cloudinaryResponse.secure_url, name, username, bio, location, x, instagram, youtube, userInfo.id, userInfo.id]

                db.query(q, values, (err, data) => {
                    if (err) return res.status(500).json(err);
                    return res.status(200).json({
                        id: userInfo.id,
                        instagram_url: instagram,
                        username: username,
                        name: name,
                        bio: bio,
                        location: location,
                        x_url: x,
                        userImg: cloudinaryResponse.secure_url,
                        profileImg: data[1][0].profileImg,
                        youtube_url: youtube,
                        message: "Profile has been updated!"
                    });
                });
            };


            if (avatar !== undefined && profile !== undefined) {
                const fileProfileFormat = profile.mimetype.split('/')[1];
                const uniqueFilenameProfile = `${uuidv4()}`;
                const { base64: base64Profile } = bufferToDataURI(fileProfileFormat, profile.buffer);
                const fileAvatarFormat = avatar.mimetype.split('/')[1];
                const uniqueFilenameAvatar = `${uuidv4()}`;
                const { base64: base64Avatar } = bufferToDataURI(fileAvatarFormat, avatar.buffer);

                const cloudinaryProfileResponse = await cloudinary.uploader.upload(`data:image/${fileProfileFormat};base64,${base64Profile}`, {
                    public_id: uniqueFilenameProfile,
                });
                const cloudinaryAvatarResponse = await cloudinary.uploader.upload(`data:image/${fileAvatarFormat};base64,${base64Avatar}`, {
                    public_id: uniqueFilenameAvatar,
                    folder: 'avatars'
                });

                const q = `UPDATE users SET userImg=?, profileImg=? , name=?, username=?, bio=?, location=? , x_url=?, instagram_url=?, youtube_url=? WHERE id=?;`;

                const values = [cloudinaryAvatarResponse.secure_url, cloudinaryProfileResponse.secure_url, name, username, bio, location, x, instagram, youtube, userInfo.id]

                await Promise.all([cloudinaryProfileResponse, cloudinaryAvatarResponse]);

                db.query(q, values, (err, data) => {
                    if (err) return res.status(500).json(err);
                    return res.status(200).json({
                        id: userInfo.id,
                        instagram_url: instagram,
                        username: username,
                        name: name,
                        bio: bio,
                        location: location,
                        x_url: x,
                        userImg: cloudinaryAvatarResponse.secure_url,
                        profileImg: cloudinaryProfileResponse.secure_url,
                        youtube_url: youtube,
                        message: "Profile has been updated!"
                    });
                });
            };
        };

        if (!avatar && !profile) {
            const q = `UPDATE users SET name=?, username=?, bio=?, location=? , x_url=?, instagram_url=?, youtube_url=? WHERE id=?;
                       SELECT * FROM users WHERE users.id=?;`;

            const values = [name, username, bio, location, x, instagram, youtube, userInfo.id, userInfo.id];

            db.query(q, values, (err, data) => {
                if (err) return res.status(500).json(err);
                return res.status(200).json({
                    id: userInfo.id,
                    instagram_url: instagram,
                    username: username,
                    name: name,
                    bio: bio,
                    location: location,
                    x_url: x,
                    userImg: data[1][0].userImg,
                    profileImg: data[1][0].profileImg,
                    youtube_url: youtube,
                    message: "Profile has been updated!"
                });
            });
        }
    });
};

export const searchQuery = (req, res) => {
    const { q } = req.query;

    let query = "SELECT id, username, name, email, userImg, location FROM users";

    if (q) {
        query += ` WHERE username LIKE '%${q}%' OR email LIKE '%${q}%' OR name LIKE '%${q}%';`;

        db.query(query, q, (err, data) => {
            if (err) return res.status(500).json(err)

            return res.status(200).json(data)
        });
    };

    if (!q) {
        query += ` LIMIT 5;`;

        db.query(query, q, (err, data) => {
            if (err) return res.status(500).json(err)

            return res.status(200).json(data)
        });
    };
};